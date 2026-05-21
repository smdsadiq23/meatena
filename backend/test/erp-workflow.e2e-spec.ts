import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuditLog } from '../src/audit/audit-log.entity';
import { AppModule } from '../src/app.module';
import { Customer } from '../src/customer/customer.entity';
import { InvoiceItem } from '../src/invoice/invoice-item.entity';
import { Invoice } from '../src/invoice/invoice.entity';
import { Ledger } from '../src/ledger/ledger.entity';
import { Payment } from '../src/payment/payment.entity';
import { Product } from '../src/product/product.entity';
import { PurchaseItem } from '../src/purchase/purchase-item.entity';
import { Purchase } from '../src/purchase/purchase.entity';
import { ShiftClose } from '../src/shift-close/shift-close.entity';
import { StockMovement } from '../src/inventory/stock-movement.entity';
import { Supplier } from '../src/supplier/supplier.entity';

type CreatedIds = {
  customerId?: number;
  productId?: number;
  supplierId?: number;
  purchaseId?: number;
  invoiceId?: number;
  paymentId?: number;
  shiftCloseId?: number;
  stockMovementIds: number[];
};

type LoginResponse = {
  access_token: string;
};

type EntityResponse = {
  id: number;
};

type PurchaseResponse = {
  purchase: { id: number };
};

type PurchaseReceiptResponse = {
  id: number;
  receipt_file_name: string | null;
  receipt_original_name: string | null;
};

type InvoiceResponse = {
  invoice: { id: number; total: number | string };
};

type DeliveryReceiptResponse = {
  id: number;
  delivery_receipt_file_name: string | null;
  delivery_receipt_original_name: string | null;
};

type PaymentResponse = {
  payment: { id: number; status?: string };
  new_balance: number | string;
};

type BalanceResponse = {
  balance: number | string;
};

type StatementEntry = {
  amount: number | string;
  balance: number | string;
};

type StockListItem = {
  id: number;
  stock_kg: number;
  low_stock: boolean;
};

type ReorderSuggestionResponse = {
  totals: {
    suggestionCount: number;
    suggestedPurchaseKg: number | string;
  };
  suggestions: Array<{
    product_id: number;
    suggested_purchase_kg: number | string;
    priority: string;
  }>;
};

type InvoiceListItem = {
  id: number;
  paid_amount: number | string;
  outstanding_amount: number | string;
  payment_status: string;
};

type ShiftSummaryResponse = {
  system_cash: number | string;
  system_knet: number | string;
  system_total: number | string;
  payment_count: number;
};

type ShiftCloseResponse = {
  id: number;
  system_total: number | string;
  counted_total: number | string;
  variance_total: number | string;
};

type CollectionFollowUpResponse = {
  totals: {
    dueCustomerCount: number;
    totalOutstanding: number | string;
  };
  customers: Array<{
    id: number;
    balance: number | string;
    status: string;
  }>;
};

describe('ERP workflow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let token: string;
  const created: CreatedIds = { stockMovementIds: [] };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201);

    token = (login.body as LoginResponse).access_token;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    await cleanupCreatedData();
    await app.close();
  });

  it('runs purchase -> inventory -> billing -> payment -> ledger end to end', async () => {
    const unique = Date.now();

    const customer = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `E2E Customer ${unique}`,
        mobile: `9${String(unique).slice(-7)}`,
      })
      .expect(201);
    created.customerId = (customer.body as EntityResponse).id;

    const supplier = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `E2E Supplier ${unique}`,
        mobile: `6${String(unique).slice(-7)}`,
      })
      .expect(201);
    created.supplierId = (supplier.body as EntityResponse).id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `E2E Meat ${unique}`,
        sku: `E2E-${unique}`,
        price_per_kg: 4,
        low_stock_kg: 8,
      })
      .expect(201);
    created.productId = (product.body as EntityResponse).id;

    const purchase = await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplier_id: created.supplierId,
        invoice_no: `E2E-PUR-${unique}`,
        items: [
          {
            product_id: created.productId,
            weight: 10,
            cost_per_kg: 2,
          },
        ],
      })
      .expect(201);
    created.purchaseId = (purchase.body as PurchaseResponse).purchase.id;

    const receiptUpload = await request(app.getHttpServer())
      .post(`/purchases/${created.purchaseId}/receipt`)
      .set('Authorization', `Bearer ${token}`)
      .attach('receipt', Buffer.from('%PDF-1.4\n% test receipt\n'), {
        filename: 'delivery-receipt.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const receiptBody = receiptUpload.body as PurchaseReceiptResponse;
    expect(receiptBody.receipt_file_name).toBeTruthy();
    expect(receiptBody.receipt_original_name).toBe('delivery-receipt.pdf');

    await request(app.getHttpServer())
      .get(`/purchases/${created.purchaseId}/receipt`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const stockAfterPurchase = await getCreatedStock();
    expect(stockAfterPurchase.stock_kg).toBe(10);
    expect(stockAfterPurchase.low_stock).toBe(false);

    const invoice = await request(app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: created.customerId,
        type: 'credit',
        invoice_number: `E2E-INV-${unique}`,
        invoice_title: 'Test Invoice',
        company_name: 'E2E Meat Company',
        company_address: 'E2E Address',
        company_phone: '12345678',
        items: [
          {
            product_id: created.productId,
            weight: 3,
            price_per_kg: 4,
          },
        ],
      })
      .expect(201);
    const invoiceBody = invoice.body as InvoiceResponse;
    created.invoiceId = invoiceBody.invoice.id;
    expect(Number(invoiceBody.invoice.total)).toBe(12);

    const deliveryReceiptUpload = await request(app.getHttpServer())
      .post(`/invoices/${created.invoiceId}/delivery-receipt`)
      .set('Authorization', `Bearer ${token}`)
      .attach('receipt', Buffer.from('%PDF-1.4\n% delivery receipt\n'), {
        filename: 'customer-delivery-receipt.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const deliveryReceiptBody =
      deliveryReceiptUpload.body as DeliveryReceiptResponse;
    expect(deliveryReceiptBody.delivery_receipt_file_name).toBeTruthy();
    expect(deliveryReceiptBody.delivery_receipt_original_name).toBe(
      'customer-delivery-receipt.pdf',
    );

    await request(app.getHttpServer())
      .get(`/invoices/${created.invoiceId}/delivery-receipt`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const stockAfterInvoice = await getCreatedStock();
    expect(stockAfterInvoice.stock_kg).toBe(7);
    expect(stockAfterInvoice.low_stock).toBe(true);

    const reorderSuggestions = await request(app.getHttpServer())
      .get('/inventory/reorder-suggestions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const reorderBody = reorderSuggestions.body as ReorderSuggestionResponse;
    const productSuggestion = reorderBody.suggestions.find(
      (item) => item.product_id === created.productId,
    );
    expect(productSuggestion).toBeDefined();
    expect(Number(productSuggestion?.suggested_purchase_kg)).toBe(9);
    expect(productSuggestion?.priority).toBe('low_stock');

    const balanceAfterInvoice = await request(app.getHttpServer())
      .get(`/ledger/balance/${created.customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Number((balanceAfterInvoice.body as BalanceResponse).balance)).toBe(
      12,
    );

    const followupsAfterInvoice = await request(app.getHttpServer())
      .get('/customers/collection-followups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const followupsAfterInvoiceBody =
      followupsAfterInvoice.body as CollectionFollowUpResponse;
    const createdFollowup = followupsAfterInvoiceBody.customers.find(
      (item) => item.id === created.customerId,
    );
    expect(createdFollowup).toBeDefined();
    expect(Number(createdFollowup?.balance)).toBe(12);
    expect(createdFollowup?.status).toBe('due');

    const payment = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: created.customerId,
        invoice_id: created.invoiceId,
        amount: 12,
        mode: 'cash',
        reference: `E2E-PAY-${unique}`,
      })
      .expect(201);
    const paymentBody = payment.body as PaymentResponse;
    created.paymentId = paymentBody.payment.id;
    expect(Number(paymentBody.new_balance)).toBe(0);

    const balanceAfterPayment = await request(app.getHttpServer())
      .get(`/ledger/balance/${created.customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Number((balanceAfterPayment.body as BalanceResponse).balance)).toBe(
      0,
    );

    const followupsAfterPayment = await request(app.getHttpServer())
      .get('/customers/collection-followups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const followupsAfterPaymentBody =
      followupsAfterPayment.body as CollectionFollowUpResponse;
    expect(
      followupsAfterPaymentBody.customers.some(
        (item) => item.id === created.customerId,
      ),
    ).toBe(false);

    const statement = await request(app.getHttpServer())
      .get(`/ledger/statement/${created.customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const statementBody = statement.body as StatementEntry[];
    expect(statementBody).toHaveLength(2);
    expect(Number(statementBody[0].amount)).toBe(12);
    expect(Number(statementBody[1].amount)).toBe(-12);
    expect(Number(statementBody[1].balance)).toBe(0);

    const statementPdf = await request(app.getHttpServer())
      .get(`/ledger/statement/${created.customerId}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(statementPdf.headers['content-type']).toContain('application/pdf');
    expect(Buffer.isBuffer(statementPdf.body)).toBe(true);
    const statementPdfBody = statementPdf.body as Buffer;
    expect(statementPdfBody.length).toBeGreaterThan(500);

    const shiftDate = new Date().toISOString().slice(0, 10);
    const shiftSummary = await request(app.getHttpServer())
      .get(`/shift-close/summary?date=${shiftDate}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const shiftSummaryBody = shiftSummary.body as ShiftSummaryResponse;
    expect(Number(shiftSummaryBody.system_cash)).toBe(12);
    expect(Number(shiftSummaryBody.system_knet)).toBe(0);
    expect(Number(shiftSummaryBody.system_total)).toBe(12);
    expect(shiftSummaryBody.payment_count).toBeGreaterThanOrEqual(1);

    const shiftClose = await request(app.getHttpServer())
      .post('/shift-close')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: shiftDate,
        counted_cash: 12,
        counted_knet: 0,
        notes: 'E2E drawer close',
      })
      .expect(201);
    const shiftCloseBody = shiftClose.body as ShiftCloseResponse;
    created.shiftCloseId = shiftCloseBody.id;
    expect(Number(shiftCloseBody.system_total)).toBe(12);
    expect(Number(shiftCloseBody.counted_total)).toBe(12);
    expect(Number(shiftCloseBody.variance_total)).toBe(0);

    const reversal = await request(app.getHttpServer())
      .post(`/payments/${created.paymentId}/reverse`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'E2E wrong collection' })
      .expect(201);
    const reversalBody = reversal.body as PaymentResponse;
    expect(reversalBody.payment.status).toBe('reversed');
    expect(Number(reversalBody.new_balance)).toBe(12);

    const invoiceList = await request(app.getHttpServer())
      .get('/invoices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const invoiceStatus = (invoiceList.body as InvoiceListItem[]).find(
      (item) => item.id === created.invoiceId,
    );
    expect(invoiceStatus?.payment_status).toBe('unpaid');
    expect(Number(invoiceStatus?.paid_amount)).toBe(0);
    expect(Number(invoiceStatus?.outstanding_amount)).toBe(12);

    const reversedStatement = await request(app.getHttpServer())
      .get(`/ledger/statement/${created.customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const reversedStatementBody = reversedStatement.body as StatementEntry[];
    expect(reversedStatementBody).toHaveLength(3);
    expect(Number(reversedStatementBody[2].amount)).toBe(12);
    expect(Number(reversedStatementBody[2].balance)).toBe(12);
  });

  async function getCreatedStock() {
    const stock = await request(app.getHttpServer())
      .get('/inventory/stock')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const stockBody = stock.body as StockListItem[];
    const item = stockBody.find(
      (stockItem) => stockItem.id === created.productId,
    );

    expect(item).toBeDefined();
    return item!;
  }

  async function cleanupCreatedData() {
    if (!dataSource?.isInitialized) {
      return;
    }

    const movementIds = created.stockMovementIds;
    const productMovementIds = created.productId
      ? await dataSource.getRepository(StockMovement).find({
          where: { product_id: created.productId },
          select: { id: true },
        })
      : [];

    movementIds.push(...productMovementIds.map((movement) => movement.id));

    const auditEntityIds = [
      created.invoiceId,
      created.purchaseId,
      created.paymentId,
      created.shiftCloseId,
      ...movementIds,
    ].filter((id): id is number => Boolean(id));

    if (auditEntityIds.length) {
      await dataSource.getRepository(AuditLog).delete({
        entity_id: In(auditEntityIds),
      });
    }

    if (created.customerId) {
      await dataSource
        .getRepository(Ledger)
        .delete({ customer_id: created.customerId });
    }

    if (created.paymentId) {
      await dataSource.getRepository(Payment).delete(created.paymentId);
    }

    if (created.shiftCloseId) {
      await dataSource.getRepository(ShiftClose).delete(created.shiftCloseId);
    }

    if (created.invoiceId) {
      const invoice = await dataSource
        .getRepository(Invoice)
        .findOne({ where: { id: created.invoiceId } });

      if (invoice?.delivery_receipt_file_name) {
        await unlink(
          join(
            process.cwd(),
            'uploads',
            'invoice-delivery-receipts',
            invoice.delivery_receipt_file_name,
          ),
        ).catch(() => undefined);
      }

      await dataSource
        .getRepository(InvoiceItem)
        .delete({ invoice_id: created.invoiceId });
      await dataSource.getRepository(Invoice).delete(created.invoiceId);
    }

    if (created.purchaseId) {
      const purchase = await dataSource
        .getRepository(Purchase)
        .findOne({ where: { id: created.purchaseId } });

      if (purchase?.receipt_file_name) {
        await unlink(
          join(
            process.cwd(),
            'uploads',
            'purchase-receipts',
            purchase.receipt_file_name,
          ),
        ).catch(() => undefined);
      }

      await dataSource
        .getRepository(PurchaseItem)
        .delete({ purchase_id: created.purchaseId });
      await dataSource.getRepository(Purchase).delete(created.purchaseId);
    }

    if (movementIds.length) {
      await dataSource
        .getRepository(StockMovement)
        .delete({ id: In(movementIds) });
    }

    if (created.productId) {
      await dataSource.getRepository(Product).delete(created.productId);
    }

    if (created.supplierId) {
      await dataSource.getRepository(Supplier).delete(created.supplierId);
    }

    if (created.customerId) {
      await dataSource.getRepository(Customer).delete(created.customerId);
    }
  }
});
