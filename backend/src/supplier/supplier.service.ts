import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
};

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,

    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,

    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepo: Repository<PurchaseItem>,

    @InjectRepository(SupplierPayment)
    private readonly paymentRepo: Repository<SupplierPayment>,
  ) {}

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
            subtotal: roundMoney(Number(purchase.subtotal ?? total)),
            discount_amount: roundMoney(Number(purchase.discount_amount ?? 0)),
            advance_paid: advancePaid,
            balance_due: balanceDue,
            weight: purchaseWeightById.get(purchase.id) ?? 0,
            transaction_currency: purchase.transaction_currency ?? 'KWD',
            exchange_rate: Number(purchase.exchange_rate ?? 3.25),
            charge: total,
            payment: advancePaid,
          },
        };
      }),
      ...payments.map((payment) => ({
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
          advance_paid: roundMoney(Number(payment.amount ?? 0)),
          balance_due: 0,
          weight: 0,
          transaction_currency: 'KWD' as const,
          exchange_rate: 3.25,
          charge: 0,
          payment: roundMoney(Number(payment.amount ?? 0)),
        },
      })),
    ].sort((left, right) => {
      const dateCompare = left.sortDate.localeCompare(right.sortDate);
      return dateCompare || left.sortId - right.sortId;
    });

    let balance = 0;
    const rows: SupplierStatementRow[] = events.map((event) => {
      balance = roundMoney(balance + event.row.charge - event.row.payment);

      return {
        ...event.row,
        balance,
      };
    });

    const charges = roundMoney(
      rows.reduce((sum, row) => sum + Number(row.charge), 0),
    );
    const paymentsTotal = roundMoney(
      rows.reduce((sum, row) => sum + Number(row.payment), 0),
    );
    const discounts = roundMoney(
      rows.reduce((sum, row) => sum + Number(row.discount_amount), 0),
    );
    const closingBalance = roundMoney(Number(supplier.balance ?? balance));

    return {
      supplier,
      rows,
      totals: {
        charges,
        payments: paymentsTotal,
        discounts,
        closing_balance: closingBalance,
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

    if (purchaseCount > 0 || paymentCount > 0 || Number(supplier.balance) !== 0) {
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
