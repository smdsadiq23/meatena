import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Purchase } from '../purchase/purchase.entity';
import { PurchaseItem } from '../purchase/purchase-item.entity';
import { SupplierPayment } from '../supplier-payment/supplier-payment.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './supplier.entity';

export type SupplierStatementRow = {
  id: string;
  date: string;
  type: 'purchase' | 'payment';
  reference: string;
  description: string;
  invoice_no: string | null;
  purchase_date: string | null;
  goods_received_date: string | null;
  subtotal: number;
  discount_amount: number;
  advance_paid: number;
  balance_due: number;
  weight: number;
  transaction_currency: 'KWD' | 'USD';
  exchange_rate: number;
  charge: number;
  payment: number;
  balance: number;
  charge_kwd: number;
  payment_kwd: number;
  balance_kwd: number;
  charge_usd: number;
  payment_usd: number;
  balance_usd: number;
};

@Injectable()
export class SupplierService implements OnModuleInit {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,

    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,

    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepo: Repository<PurchaseItem>,

    @InjectRepository(SupplierPayment)
    private readonly paymentRepo: Repository<SupplierPayment>,

    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      ALTER TABLE supplier
      ADD COLUMN IF NOT EXISTS balance_kwd numeric(12, 3) NOT NULL DEFAULT 0
    `);
    await this.dataSource.query(`
      ALTER TABLE supplier
      ADD COLUMN IF NOT EXISTS balance_usd numeric(12, 3) NOT NULL DEFAULT 0
    `);
    await this.dataSource.query(`
      UPDATE supplier
      SET balance_kwd = balance
      WHERE balance_kwd = 0 AND balance <> 0
    `);
  }

  create(data: CreateSupplierDto) {
    return this.repo.save(
      this.repo.create({
        name: data.name.trim(),
        mobile: data.mobile?.trim() || null,
        address: data.address?.trim() || null,
      }),
    );
  }

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async getStatement(id: number) {
    const supplier = await this.repo.findOne({ where: { id } });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const [purchases, payments] = await Promise.all([
      this.purchaseRepo.find({
        where: { supplier_id: id },
        order: { date: 'ASC', id: 'ASC' },
      }),
      this.paymentRepo.find({
        where: { supplier_id: id },
        order: { date: 'ASC', id: 'ASC' },
      }),
    ]);

    const purchaseWeightById = new Map<number, number>();
    const purchaseIds = purchases.map((purchase) => purchase.id);

    if (purchaseIds.length > 0) {
      const weights = await this.purchaseItemRepo
        .createQueryBuilder('item')
        .select('item.purchase_id', 'purchase_id')
        .addSelect('SUM(item.weight)', 'weight')
        .where('item.purchase_id IN (:...purchaseIds)', { purchaseIds })
        .groupBy('item.purchase_id')
        .getRawMany<{ purchase_id: number | string; weight: string }>();

      for (const item of weights) {
        purchaseWeightById.set(Number(item.purchase_id), roundMoney(Number(item.weight ?? 0)));
      }
    }

    const events = [
      ...purchases.map((purchase) => {
        const total = roundMoney(Number(purchase.total ?? 0));
        const advancePaid = roundMoney(Number(purchase.advance_paid ?? 0));
        const balanceDue = roundMoney(Number(purchase.balance_due ?? total - advancePaid));
        const purchaseDate = purchase.purchase_date || purchase.date;
        const exchangeRate = Number(purchase.exchange_rate ?? 1);
        const purchaseCurrency = purchase.transaction_currency ?? 'KWD';
        const totalInCurrency =
          purchaseCurrency === 'USD' ? roundMoney(total * exchangeRate) : total;
        const advanceInCurrency =
          purchaseCurrency === 'USD' ? roundMoney(advancePaid * exchangeRate) : advancePaid;
        const balanceDueInCurrency =
          purchaseCurrency === 'USD' ? roundMoney(balanceDue * exchangeRate) : balanceDue;
        const subtotalInCurrency =
          purchaseCurrency === 'USD'
            ? roundMoney(Number(purchase.subtotal ?? total) * exchangeRate)
            : roundMoney(Number(purchase.subtotal ?? total));
        const discountInCurrency =
          purchaseCurrency === 'USD'
            ? roundMoney(Number(purchase.discount_amount ?? 0) * exchangeRate)
            : roundMoney(Number(purchase.discount_amount ?? 0));

        return {
          sortDate: purchaseDate,
          sortId: purchase.id,
          row: {
            id: `purchase-${purchase.id}`,
            date: purchaseDate,
            type: 'purchase' as const,
            reference: purchase.invoice_no || `Purchase #${purchase.id}`,
            description: `Purchase ${purchase.invoice_no || `#${purchase.id}`}`,
            invoice_no: purchase.invoice_no,
            purchase_date: purchase.purchase_date,
            goods_received_date: purchase.goods_received_date,
            subtotal: subtotalInCurrency,
            discount_amount: discountInCurrency,
            advance_paid: advanceInCurrency,
            balance_due: balanceDueInCurrency,
            weight: purchaseWeightById.get(purchase.id) ?? 0,
            transaction_currency: purchaseCurrency,
            exchange_rate: exchangeRate,
            charge: totalInCurrency,
            payment: advanceInCurrency,
            charge_kwd: purchaseCurrency === 'KWD' ? totalInCurrency : 0,
            payment_kwd: purchaseCurrency === 'KWD' ? advanceInCurrency : 0,
            charge_usd: purchaseCurrency === 'USD' ? totalInCurrency : 0,
            payment_usd: purchaseCurrency === 'USD' ? advanceInCurrency : 0,
          },
        };
      }),
      ...payments.map((payment) => {
        const paymentCurrency = payment.transaction_currency ?? 'KWD';
        const amount = roundMoney(Number(payment.amount ?? 0));

        return {
          sortDate: payment.date,
          sortId: payment.id,
          row: {
            id: `payment-${payment.id}`,
            date: payment.date,
            type: 'payment' as const,
            reference: payment.reference_no || `Payment #${payment.id}`,
            description: payment.note
              ? `${payment.mode.toUpperCase()} supplier payment - ${payment.note}`
              : `${payment.mode.toUpperCase()} supplier payment`,
            invoice_no: payment.reference_no,
            purchase_date: null,
            goods_received_date: null,
            subtotal: 0,
            discount_amount: 0,
            advance_paid: amount,
            balance_due: 0,
            weight: 0,
            transaction_currency: paymentCurrency,
            exchange_rate: Number(payment.exchange_rate ?? 1),
            charge: 0,
            payment: amount,
            charge_kwd: 0,
            payment_kwd: paymentCurrency === 'KWD' ? amount : 0,
            charge_usd: 0,
            payment_usd: paymentCurrency === 'USD' ? amount : 0,
          },
        };
      }),
    ].sort((left, right) => {
      const dateCompare = left.sortDate.localeCompare(right.sortDate);
      return dateCompare || left.sortId - right.sortId;
    });

    let balanceKwd = 0;
    let balanceUsd = 0;
    const rows: SupplierStatementRow[] = events.map((event) => {
      balanceKwd = roundMoney(balanceKwd + event.row.charge_kwd - event.row.payment_kwd);
      balanceUsd = roundMoney(balanceUsd + event.row.charge_usd - event.row.payment_usd);

      return {
        ...event.row,
        balance: event.row.transaction_currency === 'USD' ? balanceUsd : balanceKwd,
        balance_kwd: balanceKwd,
        balance_usd: balanceUsd,
      };
    });

    const chargesKwd = roundMoney(rows.reduce((sum, row) => sum + Number(row.charge_kwd), 0));
    const chargesUsd = roundMoney(rows.reduce((sum, row) => sum + Number(row.charge_usd), 0));
    const paymentsKwd = roundMoney(rows.reduce((sum, row) => sum + Number(row.payment_kwd), 0));
    const paymentsUsd = roundMoney(rows.reduce((sum, row) => sum + Number(row.payment_usd), 0));
    const discounts = roundMoney(
      rows.reduce((sum, row) => sum + Number(row.discount_amount), 0),
    );
    const closingBalanceKwd = roundMoney(Number(supplier.balance_kwd ?? supplier.balance ?? balanceKwd));
    const closingBalanceUsd = roundMoney(Number(supplier.balance_usd ?? balanceUsd));

    return {
      supplier,
      rows,
      totals: {
        charges: chargesKwd,
        payments: paymentsKwd,
        discounts,
        closing_balance: closingBalanceKwd,
        charges_kwd: chargesKwd,
        payments_kwd: paymentsKwd,
        closing_balance_kwd: closingBalanceKwd,
        charges_usd: chargesUsd,
        payments_usd: paymentsUsd,
        closing_balance_usd: closingBalanceUsd,
      },
    };
  }

  async update(id: number, data: UpdateSupplierDto) {
    const supplier = await this.repo.findOne({ where: { id } });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    if (data.name !== undefined) {
      supplier.name = data.name.trim();
    }
    if (data.mobile !== undefined) {
      supplier.mobile = data.mobile.trim() || null;
    }
    if (data.address !== undefined) {
      supplier.address = data.address.trim() || null;
    }

    return this.repo.save(supplier);
  }

  async remove(id: number) {
    const supplier = await this.repo.findOne({ where: { id } });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const [purchaseCount, paymentCount] = await Promise.all([
      this.purchaseRepo.count({ where: { supplier_id: id } }),
      this.paymentRepo.count({ where: { supplier_id: id } }),
    ]);

    if (
      purchaseCount > 0 ||
      paymentCount > 0 ||
      Number(supplier.balance_kwd ?? supplier.balance) !== 0 ||
      Number(supplier.balance_usd ?? 0) !== 0
    ) {
      throw new BadRequestException(
        'Supplier has purchases, payments, or a balance. Keep it for reporting instead of deleting.',
      );
    }

    await this.repo.delete(id);

    return {
      message: `Supplier ${supplier.name} deleted successfully.`,
    };
  }
}
