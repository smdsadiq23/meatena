import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Purchase } from '../purchase/purchase.entity';
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

    const events = [
      ...purchases.map((purchase) => {
        const balanceDue = roundMoney(Number(purchase.balance_due ?? 0));
        const charge = balanceDue > 0 ? balanceDue : 0;
        const payment = balanceDue < 0 ? Math.abs(balanceDue) : 0;
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
            charge,
            payment,
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
          description: `${payment.mode.toUpperCase()} supplier payment`,
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
    const closingBalance = roundMoney(Number(supplier.balance ?? balance));

    return {
      supplier,
      rows,
      totals: {
        charges,
        payments: paymentsTotal,
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
