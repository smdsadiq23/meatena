import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { DataSource, In, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Customer } from '../customer/customer.entity';
import { Expense } from '../expense/expense.entity';
import { InventoryService } from '../inventory/inventory.service';
import { StockMovement } from '../inventory/stock-movement.entity';
import { LedgerService } from '../ledger/ledger.service';
import { Payment } from '../payment/payment.entity';
import { Product } from '../product/product.entity';
import { Purchase } from '../purchase/purchase.entity';
import { Supplier } from '../supplier/supplier.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { InvoiceItem } from './invoice-item.entity';
import { Invoice } from './invoice.entity';

type UploadedDeliveryReceiptFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type InvoiceWithNumber = Invoice & {
  invoice_number: string;
};

type ProductInvoiceName = {
  name: string;
  name_ar: string | null;
};

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseRangeDate(value: string | undefined, fallback: Date, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

function inDateRange(value: string, start: Date, end: Date) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start && date <= end;
}

@Injectable()
export class InvoiceService implements OnModuleInit {
  private readonly deliveryReceiptDirectory = join(
    process.cwd(),
    'uploads',
    'invoice-delivery-receipts',
  );

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private itemRepo: Repository<InvoiceItem>,

    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,

    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,

    private dataSource: DataSource,
    private ledgerService: LedgerService,
    private inventoryService: InventoryService,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      ALTER TABLE invoice
      ADD COLUMN IF NOT EXISTS transaction_currency varchar NOT NULL DEFAULT 'KWD'
    `);
    await this.dataSource.query(`
      ALTER TABLE invoice
      ADD COLUMN IF NOT EXISTS exchange_rate numeric(12, 6) NOT NULL DEFAULT 3.25
    `);
  }

  async create(data: CreateInvoiceDto) {
    const { customer_id, items, type } = data;
    const transactionCurrency = data.transaction_currency ?? 'KWD';
    const exchangeRate = Number(data.exchange_rate ?? process.env.KWD_TO_USD_RATE ?? 3.25);

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new BadRequestException('Exchange rate must be greater than zero');
    }

    return this.dataSource.transaction(async (manager) => {
      const invoice_number = data.invoice_number.trim();
      const existingInvoiceNumber = await manager
        .getRepository(Invoice)
        .findOne({ where: { invoice_number } });

      if (existingInvoiceNumber) {
        throw new BadRequestException(
          `Invoice number ${invoice_number} already exists.`,
        );
      }

      const customer = await manager
        .getRepository(Customer)
        .findOne({ where: { id: customer_id } });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      if (!items.length) {
        throw new BadRequestException('At least one invoice item is required');
      }

      let total = 0;
      const calculatedItems = items.map((item) => {
        const pricePerKg = roundMoney(
          transactionCurrency === 'USD'
            ? item.price_per_kg / exchangeRate
            : item.price_per_kg,
        );
        const amount = roundMoney(item.weight * pricePerKg);
        total = roundMoney(total + amount);

        return {
          product_id: item.product_id ?? null,
          weight: roundMoney(item.weight),
          pieces: item.pieces ?? null,
          price_per_kg: pricePerKg,
          amount,
        };
      });

      for (const item of calculatedItems) {
        if (!item.product_id) {
          continue;
        }

        const product = await manager
          .getRepository(Product)
          .findOne({ where: { id: item.product_id } });

        if (!product) {
          throw new NotFoundException(`Product ${item.product_id} not found`);
        }
      }

      const previous_balance = await this.ledgerService.getBalance(
        customer_id,
        manager,
      );

      const creditLimit = roundMoney(Number(customer.credit_limit ?? 0));

      if (
        type === 'credit' &&
        creditLimit > 0 &&
        roundMoney(previous_balance + total) > creditLimit
      ) {
        throw new BadRequestException(
          `Credit limit exceeded. Current balance ${previous_balance.toFixed(3)}, invoice total ${total.toFixed(3)}, limit ${creditLimit.toFixed(3)}.`,
        );
      }

      const grand_total = roundMoney(total + previous_balance);
      const date = new Date().toISOString();

      const invoice = await manager.getRepository(Invoice).save({
        customer_id,
        date,
        type,
        transaction_currency: transactionCurrency,
        exchange_rate: roundMoney(exchangeRate),
        invoice_number,
        invoice_title: data.invoice_title.trim(),
        invoice_title_ar: cleanText(data.invoice_title_ar),
        company_name: data.company_name.trim(),
        company_name_ar: cleanText(data.company_name_ar),
        company_activity: cleanText(data.company_activity),
        company_activity_ar: cleanText(data.company_activity_ar),
        company_address: data.company_address.trim(),
        company_phone: data.company_phone.trim(),
        company_email: cleanText(data.company_email),
        contact_names: cleanText(data.contact_names),
        total,
        previous_balance,
        grand_total,
      });

      for (const item of calculatedItems) {
        await manager.getRepository(InvoiceItem).save({
          invoice_id: invoice.id,
          ...item,
        });

        if (item.product_id) {
          await this.inventoryService.applyMovement(
            {
              product_id: item.product_id,
              type: 'sale',
              quantity_kg: -item.weight,
              reference_type: 'invoice',
              reference_id: invoice.id,
              date,
            },
            manager,
          );
        }
      }

      await this.ledgerService.addEntry(
        {
          customer_id,
          type: 'invoice',
          amount: total,
          reference_id: invoice.id,
          date,
        },
        manager,
      );

      return {
        message: 'Invoice created',
        invoice: this.withInvoiceNumber(invoice),
      };
    });
  }

  async findAll() {
    const [invoices, payments] = await Promise.all([
      this.invoiceRepo.find({ order: { date: 'DESC', id: 'DESC' } }),
      this.paymentRepo.find(),
    ]);
    const paidByInvoice = new Map<number, number>();
    const paymentCountByInvoice = new Map<number, number>();

    for (const payment of payments) {
      if (!payment.invoice_id || payment.status === 'reversed') {
        continue;
      }

      paidByInvoice.set(
        payment.invoice_id,
        roundMoney(
          (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount),
        ),
      );
      paymentCountByInvoice.set(
        payment.invoice_id,
        (paymentCountByInvoice.get(payment.invoice_id) ?? 0) + 1,
      );
    }

    return invoices.map((invoice) => {
      const paid_amount = roundMoney(paidByInvoice.get(invoice.id) ?? 0);
      const outstanding_amount = roundMoney(
        invoice.status === 'void'
          ? 0
          : Math.max(Number(invoice.total) - paid_amount, 0),
      );
      const payment_status =
        invoice.status === 'void'
          ? 'void'
          : outstanding_amount <= 0
            ? 'paid'
            : paid_amount > 0
              ? 'partial'
              : 'unpaid';

      return {
        ...invoice,
        invoice_number: this.getInvoiceNumber(invoice),
        paid_amount,
        outstanding_amount,
        payment_status,
        payment_count: paymentCountByInvoice.get(invoice.id) ?? 0,
      };
    });
  }

  async voidInvoice(id: number, data: VoidInvoiceDto, user?: { sub: number }) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager
        .getRepository(Invoice)
        .findOne({ where: { id } });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status === 'void') {
        throw new BadRequestException('Invoice is already voided');
      }

      const payments = await manager
        .getRepository(Payment)
        .find({ where: { invoice_id: id } });
      const paymentCount = payments.filter(
        (payment) => payment.status !== 'reversed',
      ).length;

      if (paymentCount > 0) {
        throw new BadRequestException(
          'Cannot void an invoice with linked payments. Reverse the payment first.',
        );
      }

      const items = await manager
        .getRepository(InvoiceItem)
        .find({ where: { invoice_id: id } });
      const date = new Date().toISOString();

      for (const item of items) {
        if (!item.product_id) {
          continue;
        }

        await this.inventoryService.applyMovement(
          {
            product_id: item.product_id,
            type: 'adjustment',
            quantity_kg: Number(item.weight),
            reference_type: 'invoice_void',
            reference_id: invoice.id,
            note: `Void invoice #${invoice.id}`,
            date,
          },
          manager,
        );
      }

      await this.ledgerService.addEntry(
        {
          customer_id: invoice.customer_id,
          type: 'invoice_void',
          amount: -Number(invoice.total),
          reference_id: invoice.id,
          date,
        },
        manager,
      );

      invoice.status = 'void';
      invoice.void_reason = data.reason?.trim() || null;
      invoice.voided_at = date;
      invoice.voided_by = user?.sub ?? null;

      const savedInvoice = await manager.getRepository(Invoice).save(invoice);

      return {
        message: 'Invoice voided',
        invoice: savedInvoice,
      };
    });
  }

  async getInvoiceDetail(id: number) {
    const invoice = await this.getInvoiceById(id);
    const [items, customer, payments] = await Promise.all([
      this.getItemsByInvoice(id),
      this.getCustomer(invoice.customer_id),
      this.paymentRepo.find({ where: { invoice_id: id }, order: { id: 'DESC' } }),
    ]);
    const productNames = await this.getProductNamesForItems(items);
    const activePayments = payments.filter(
      (payment) => payment.status !== 'reversed',
    );
    const paid_amount = roundMoney(
      activePayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
    );
    const outstanding_amount = roundMoney(
      invoice.status === 'void'
        ? 0
        : Math.max(Number(invoice.total) - paid_amount, 0),
    );
    const payment_status =
      invoice.status === 'void'
        ? 'void'
        : outstanding_amount <= 0
          ? 'paid'
          : paid_amount > 0
            ? 'partial'
            : 'unpaid';

    return {
      ...invoice,
      invoice_number: this.getInvoiceNumber(invoice),
      customer,
      items: items.map((item) => ({
        ...item,
        product_name: item.product_id
          ? productNames.get(item.product_id)?.name ?? `Product #${item.product_id}`
          : 'Custom item',
        product_name_ar: item.product_id
          ? productNames.get(item.product_id)?.name_ar ?? null
          : null,
      })),
      payments,
      paid_amount,
      outstanding_amount,
      payment_status,
      payment_count: activePayments.length,
    };
  }

  async uploadDeliveryReceipt(
    id: number,
    file: UploadedDeliveryReceiptFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Delivery receipt file is required');
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Delivery receipt must be a PDF, JPG, PNG, or WEBP file',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException(
        'Delivery receipt file must be 10 MB or smaller',
      );
    }

    const invoice = await this.getInvoiceById(id);

    if (invoice.status === 'void') {
      throw new BadRequestException(
        'Cannot upload delivery receipt for a void invoice',
      );
    }

    await mkdir(this.deliveryReceiptDirectory, { recursive: true });

    const extension = this.getSafeReceiptExtension(file);
    const fileName = `invoice-${id}-delivery-${Date.now()}${extension}`;
    await writeFile(join(this.deliveryReceiptDirectory, fileName), file.buffer);

    invoice.delivery_receipt_original_name = file.originalname;
    invoice.delivery_receipt_file_name = fileName;
    invoice.delivery_receipt_mime_type = file.mimetype;
    invoice.delivery_receipt_size = file.size;
    invoice.delivery_receipt_uploaded_at = new Date().toISOString();

    return this.invoiceRepo.save(invoice);
  }

  async getDeliveryReceiptFile(id: number) {
    const invoice = await this.getInvoiceById(id);

    if (!invoice.delivery_receipt_file_name) {
      throw new NotFoundException('Delivery receipt not found');
    }

    return {
      path: join(
        this.deliveryReceiptDirectory,
        invoice.delivery_receipt_file_name,
      ),
      originalName:
        invoice.delivery_receipt_original_name ??
        invoice.delivery_receipt_file_name,
      mimeType:
        invoice.delivery_receipt_mime_type ?? 'application/octet-stream',
    };
  }

  async getInvoiceById(id: number) {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  getInvoiceNumber(invoice: Invoice) {
    if (invoice.invoice_number) {
      return invoice.invoice_number;
    }

    return `#${invoice.id}`;
  }

  withInvoiceNumber(invoice: Invoice): InvoiceWithNumber {
    return {
      ...invoice,
      invoice_number: this.getInvoiceNumber(invoice),
    };
  }

  private getSafeReceiptExtension(file: UploadedDeliveryReceiptFile) {
    const extension = extname(file.originalname).toLowerCase();

    if (['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
      return extension;
    }

    if (file.mimetype === 'application/pdf') {
      return '.pdf';
    }

    if (file.mimetype === 'image/png') {
      return '.png';
    }

    if (file.mimetype === 'image/webp') {
      return '.webp';
    }

    return '.jpg';
  }

  async getItemsByInvoice(id: number) {
    return this.itemRepo.find({ where: { invoice_id: id } });
  }

  async getProductNamesForItems(
    items: InvoiceItem[],
  ): Promise<Map<number, ProductInvoiceName>> {
    const productIds = [
      ...new Set(
        items
          .map((item) => item.product_id)
          .filter((productId): productId is number => Boolean(productId)),
      ),
    ];

    if (!productIds.length) {
      return new Map<number, ProductInvoiceName>();
    }

    const products = await this.dataSource
      .getRepository(Product)
      .find({ where: { id: In(productIds) } });

    return new Map(
      products.map((product) => [
        product.id,
        { name: product.name, name_ar: product.name_ar },
      ]),
    );
  }

  async getCustomer(id: number) {
    const customer = await this.customerRepo.findOne({ where: { id } });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async getDashboard() {
    const invoices = await this.invoiceRepo.find();
    const payments = await this.paymentRepo.find();
    const customers = await this.customerRepo.find();

    const today = new Date().toISOString().slice(0, 10);

    let todaySales = 0;
    let invoiceCount = 0;

    invoices.forEach((inv) => {
      if (inv.status !== 'void' && inv.date.startsWith(today)) {
        todaySales = roundMoney(todaySales + Number(inv.total));
        invoiceCount += 1;
      }
    });

    let todayCollection = 0;

    payments.forEach((payment) => {
      if (payment.date.startsWith(today)) {
        todayCollection = roundMoney(todayCollection + Number(payment.amount));
      }
    });

    let outstanding = 0;

    for (const customer of customers) {
      const balance = await this.ledgerService.getBalance(customer.id);
      outstanding = roundMoney(outstanding + balance);
    }

    return {
      todaySales,
      todayCollection,
      outstanding,
      invoiceCount,
    };
  }

  async getProfitDashboard() {
    const today = new Date().toISOString().slice(0, 10);

    const invoices = await this.invoiceRepo.find();
    const expenses = await this.dataSource.getRepository(Expense).find();

    let sales = 0;
    let expenseTotal = 0;

    invoices.forEach((inv) => {
      if (inv.status !== 'void' && inv.date.startsWith(today)) {
        sales = roundMoney(sales + Number(inv.total));
      }
    });

    expenses.forEach((expense) => {
      if (expense.date.startsWith(today)) {
        expenseTotal = roundMoney(expenseTotal + Number(expense.amount));
      }
    });

    const profit = roundMoney(sales - expenseTotal);

    return {
      sales,
      expenseTotal,
      profit,
    };
  }

  async getReport(type: string) {
    const reportType = ['day', 'week', 'month', 'year'].includes(type)
      ? type
      : 'day';

    const invoices = await this.invoiceRepo.find();
    const expenses = await this.dataSource.getRepository(Expense).find();
    const now = new Date();
    let startDate = new Date();

    if (reportType === 'day') {
      startDate.setHours(0, 0, 0, 0);
    }

    if (reportType === 'week') {
      const day = now.getDay();
      startDate.setDate(now.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
    }

    if (reportType === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (reportType === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    let sales = 0;
    let expenseTotal = 0;

    invoices.forEach((invoice) => {
      if (invoice.status !== 'void' && new Date(invoice.date) >= startDate) {
        sales = roundMoney(sales + Number(invoice.total));
      }
    });

    expenses.forEach((expense) => {
      if (new Date(expense.date) >= startDate) {
        expenseTotal = roundMoney(expenseTotal + Number(expense.amount));
      }
    });

    return {
      type: reportType,
      sales,
      expenses: expenseTotal,
      profit: roundMoney(sales - expenseTotal),
    };
  }

  async getHistoricReport(from?: string, to?: string) {
    const today = new Date();
    const fallbackStart = new Date(today);
    fallbackStart.setDate(today.getDate() - 29);
    fallbackStart.setUTCHours(0, 0, 0, 0);

    const start = parseRangeDate(from, fallbackStart);
    const end = parseRangeDate(to, today, true);

    if (start > end) {
      throw new BadRequestException('From date must be before to date.');
    }

    const [
      invoices,
      payments,
      expenses,
      purchases,
      stockMovements,
      customers,
      suppliers,
      products,
    ] = await Promise.all([
      this.invoiceRepo.find({ order: { date: 'DESC', id: 'DESC' } }),
      this.paymentRepo.find({ order: { date: 'DESC', id: 'DESC' } }),
      this.dataSource.getRepository(Expense).find({
        order: { date: 'DESC', id: 'DESC' },
      }),
      this.dataSource.getRepository(Purchase).find({
        order: { date: 'DESC', id: 'DESC' },
      }),
      this.dataSource.getRepository(StockMovement).find({
        order: { date: 'DESC', id: 'DESC' },
      }),
      this.customerRepo.find(),
      this.dataSource.getRepository(Supplier).find(),
      this.dataSource.getRepository(Product).find(),
    ]);

    const customerNameById = new Map(
      customers.map((customer) => [customer.id, customer.name]),
    );
    const supplierNameById = new Map(
      suppliers.map((supplier) => [supplier.id, supplier.name]),
    );
    const productNameById = new Map(
      products.map((product) => [product.id, product.name]),
    );

    const rangeInvoices = invoices.filter(
      (invoice) => invoice.status !== 'void' && inDateRange(invoice.date, start, end),
    );
    const voidInvoices = invoices.filter(
      (invoice) => invoice.status === 'void' && inDateRange(invoice.date, start, end),
    );
    const rangePayments = payments.filter(
      (payment) => payment.status !== 'reversed' && inDateRange(payment.date, start, end),
    );
    const rangeReversals = payments.filter(
      (payment) =>
        payment.reversed_at && inDateRange(payment.reversed_at, start, end),
    );
    const rangeExpenses = expenses.filter((expense) =>
      inDateRange(expense.date, start, end),
    );
    const rangePurchases = purchases.filter((purchase) =>
      inDateRange(purchase.date, start, end),
    );
    const rangeMovements = stockMovements.filter((movement) =>
      inDateRange(movement.date, start, end),
    );

    const salesTotal = rangeInvoices.reduce(
      (sum, invoice) => roundMoney(sum + Number(invoice.total)),
      0,
    );
    const cashSales = rangeInvoices
      .filter((invoice) => invoice.type === 'cash')
      .reduce((sum, invoice) => roundMoney(sum + Number(invoice.total)), 0);
    const creditSales = roundMoney(salesTotal - cashSales);
    const collectionTotal = rangePayments.reduce(
      (sum, payment) => roundMoney(sum + Number(payment.amount)),
      0,
    );
    const cashCollection = rangePayments
      .filter((payment) => payment.mode === 'cash')
      .reduce((sum, payment) => roundMoney(sum + Number(payment.amount)), 0);
    const knetCollection = rangePayments
      .filter((payment) => payment.mode === 'knet' || payment.mode === 'card')
      .reduce((sum, payment) => roundMoney(sum + Number(payment.amount)), 0);
    const reversalTotal = rangeReversals.reduce(
      (sum, payment) => roundMoney(sum + Number(payment.amount)),
      0,
    );
    const expenseTotal = rangeExpenses.reduce(
      (sum, expense) => roundMoney(sum + Number(expense.amount)),
      0,
    );
    const purchaseTotal = rangePurchases.reduce(
      (sum, purchase) => roundMoney(sum + Number(purchase.total)),
      0,
    );

    const stockInKg = rangeMovements
      .filter((movement) => Number(movement.quantity_kg) > 0)
      .reduce((sum, movement) => roundMoney(sum + Number(movement.quantity_kg)), 0);
    const stockOutKg = rangeMovements
      .filter((movement) => Number(movement.quantity_kg) < 0)
      .reduce(
        (sum, movement) => roundMoney(sum + Math.abs(Number(movement.quantity_kg))),
        0,
      );
    const wastageKg = rangeMovements
      .filter((movement) => movement.type === 'wastage')
      .reduce(
        (sum, movement) => roundMoney(sum + Math.abs(Number(movement.quantity_kg))),
        0,
      );

    return {
      range: {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      },
      totals: {
        invoiceCount: rangeInvoices.length,
        voidInvoiceCount: voidInvoices.length,
        paymentCount: rangePayments.length,
        reversalCount: rangeReversals.length,
        expenseCount: rangeExpenses.length,
        purchaseCount: rangePurchases.length,
        stockMovementCount: rangeMovements.length,
        salesTotal,
        cashSales,
        creditSales,
        collectionTotal,
        cashCollection,
        knetCollection,
        reversalTotal,
        netCollection: roundMoney(collectionTotal - reversalTotal),
        expenseTotal,
        purchaseTotal,
        grossProfit: roundMoney(salesTotal - expenseTotal),
        netCash: roundMoney(collectionTotal - reversalTotal - expenseTotal),
        stockInKg,
        stockOutKg,
        wastageKg,
      },
      invoices: rangeInvoices.slice(0, 25).map((invoice) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number ?? `#${invoice.id}`,
        customer_name:
          customerNameById.get(invoice.customer_id) ??
          `Customer #${invoice.customer_id}`,
        total: Number(invoice.total),
        type: invoice.type,
        status: invoice.status,
        date: invoice.date,
      })),
      payments: rangePayments.slice(0, 25).map((payment) => ({
        id: payment.id,
        customer_name:
          customerNameById.get(payment.customer_id) ??
          `Customer #${payment.customer_id}`,
        amount: Number(payment.amount),
        mode: payment.mode,
        reference: payment.reference,
        date: payment.date,
      })),
      expenses: rangeExpenses.slice(0, 25).map((expense) => ({
        id: expense.id,
        title: expense.title,
        category: expense.category,
        amount: Number(expense.amount),
        date: expense.date,
      })),
      purchases: rangePurchases.slice(0, 25).map((purchase) => ({
        id: purchase.id,
        supplier_name:
          supplierNameById.get(purchase.supplier_id) ??
          `Supplier #${purchase.supplier_id}`,
        invoice_no: purchase.invoice_no,
        total: Number(purchase.total),
        date: purchase.date,
      })),
      stockMovements: rangeMovements.slice(0, 30).map((movement) => ({
        id: movement.id,
        product_name:
          productNameById.get(movement.product_id) ??
          `Product #${movement.product_id}`,
        type: movement.type,
        quantity_kg: Number(movement.quantity_kg),
        balance_after_kg: Number(movement.balance_after_kg),
        note: movement.note,
        date: movement.date,
      })),
      topCustomers: customers
        .map((customer) => {
          const customerInvoices = rangeInvoices.filter(
            (invoice) => invoice.customer_id === customer.id,
          );
          const sales = customerInvoices.reduce(
            (sum, invoice) => roundMoney(sum + Number(invoice.total)),
            0,
          );
          const collected = rangePayments
            .filter((payment) => payment.customer_id === customer.id)
            .reduce((sum, payment) => roundMoney(sum + Number(payment.amount)), 0);

          return {
            id: customer.id,
            name: customer.name,
            sales,
            collected,
            invoiceCount: customerInvoices.length,
          };
        })
        .filter((customer) => customer.sales > 0 || customer.collected > 0)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10),
      topProducts: products
        .map((product) => {
          const productMovements = rangeMovements.filter(
            (movement) => movement.product_id === product.id,
          );
          const soldKg = productMovements
            .filter((movement) => movement.type === 'sale')
            .reduce(
              (sum, movement) =>
                roundMoney(sum + Math.abs(Number(movement.quantity_kg))),
              0,
            );
          const purchasedKg = productMovements
            .filter((movement) => movement.type === 'purchase')
            .reduce(
              (sum, movement) => roundMoney(sum + Number(movement.quantity_kg)),
              0,
            );

          return {
            id: product.id,
            name: product.name,
            soldKg,
            purchasedKg,
            currentStockKg: Number(product.stock_kg),
          };
        })
        .filter((product) => product.soldKg > 0 || product.purchasedKg > 0)
        .sort((a, b) => b.soldKg - a.soldKg)
        .slice(0, 10),
    };
  }

  async getDailyClose(date?: string) {
    const targetDate =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date().toISOString().slice(0, 10);

    const [invoices, payments, expenses, customers] = await Promise.all([
      this.invoiceRepo.find({ order: { date: 'DESC', id: 'DESC' } }),
      this.paymentRepo.find({ order: { date: 'DESC', id: 'DESC' } }),
      this.dataSource.getRepository(Expense).find({
        order: { date: 'DESC', id: 'DESC' },
      }),
      this.customerRepo.find(),
    ]);
    const customerNameById = new Map(
      customers.map((customer) => [customer.id, customer.name]),
    );
    const dayInvoices = invoices.filter(
      (invoice) =>
        invoice.status !== 'void' && invoice.date.startsWith(targetDate),
    );
    const dayPayments = payments.filter(
      (payment) =>
        payment.status !== 'reversed' && payment.date.startsWith(targetDate),
    );
    const dayReversedPayments = payments.filter((payment) =>
      payment.reversed_at?.startsWith(targetDate),
    );
    const dayExpenses = expenses.filter((expense) =>
      expense.date.startsWith(targetDate),
    );

    let salesTotal = 0;
    let cashSales = 0;
    let creditSales = 0;

    for (const invoice of dayInvoices) {
      const total = Number(invoice.total);
      salesTotal = roundMoney(salesTotal + total);

      if (invoice.type === 'cash') {
        cashSales = roundMoney(cashSales + total);
      } else {
        creditSales = roundMoney(creditSales + total);
      }
    }

    let collectionTotal = 0;
    let cashCollection = 0;
    let knetCollection = 0;

    for (const payment of dayPayments) {
      const amount = Number(payment.amount);
      collectionTotal = roundMoney(collectionTotal + amount);

      if (payment.mode === 'knet' || payment.mode === 'card') {
        knetCollection = roundMoney(knetCollection + amount);
      } else {
        cashCollection = roundMoney(cashCollection + amount);
      }
    }

    let expenseTotal = 0;

    for (const expense of dayExpenses) {
      expenseTotal = roundMoney(expenseTotal + Number(expense.amount));
    }

    const reversalTotal = dayReversedPayments.reduce(
      (sum, payment) => roundMoney(sum + Number(payment.amount)),
      0,
    );
    const netCollection = roundMoney(collectionTotal - reversalTotal);

    return {
      date: targetDate,
      totals: {
        invoiceCount: dayInvoices.length,
        paymentCount: dayPayments.length,
        reversalCount: dayReversedPayments.length,
        expenseCount: dayExpenses.length,
        salesTotal,
        cashSales,
        creditSales,
        collectionTotal,
        reversalTotal,
        netCollection,
        cashCollection,
        knetCollection,
        expenseTotal,
        netCash: roundMoney(netCollection - expenseTotal),
        profitEstimate: roundMoney(salesTotal - expenseTotal),
        creditMovement: roundMoney(salesTotal - netCollection),
      },
      invoices: dayInvoices.slice(0, 10).map((invoice) => ({
        id: invoice.id,
        customer_id: invoice.customer_id,
        customer_name:
          customerNameById.get(invoice.customer_id) ??
          `Customer #${invoice.customer_id}`,
        total: Number(invoice.total),
        type: invoice.type,
        date: invoice.date,
      })),
      payments: dayPayments.slice(0, 10).map((payment) => ({
        id: payment.id,
        customer_id: payment.customer_id,
        customer_name:
          customerNameById.get(payment.customer_id) ??
          `Customer #${payment.customer_id}`,
        amount: Number(payment.amount),
        mode: payment.mode,
        date: payment.date,
      })),
      reversals: dayReversedPayments.slice(0, 10).map((payment) => ({
        id: payment.id,
        customer_id: payment.customer_id,
        customer_name:
          customerNameById.get(payment.customer_id) ??
          `Customer #${payment.customer_id}`,
        amount: Number(payment.amount),
        mode: payment.mode,
        date: payment.reversed_at,
        reason: payment.reversal_reason,
      })),
      expenses: dayExpenses.slice(0, 10).map((expense) => ({
        id: expense.id,
        title: expense.title,
        category: expense.category,
        amount: Number(expense.amount),
        date: expense.date,
      })),
    };
  }
}
