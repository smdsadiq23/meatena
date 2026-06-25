import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Supplier } from '../supplier/supplier.entity';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { SupplierPayment } from './supplier-payment.entity';

@Injectable()
export class SupplierPaymentService implements OnModuleInit {
  constructor(
    @InjectRepository(SupplierPayment)
    private readonly paymentRepo: Repository<SupplierPayment>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      ALTER TABLE supplier_payment
      ADD COLUMN IF NOT EXISTS transaction_currency varchar NOT NULL DEFAULT 'KWD'
    `);
    await this.dataSource.query(`
      ALTER TABLE supplier_payment
      ADD COLUMN IF NOT EXISTS exchange_rate numeric(12, 6) NOT NULL DEFAULT 1
    `);
  }

  create(data: CreateSupplierPaymentDto) {
    const transactionCurrency = data.transaction_currency ?? 'KWD';
    if (transactionCurrency === 'USD' && data.exchange_rate === undefined) {
      throw new BadRequestException('Enter the manual KWD to USD rate for this USD supplier payment');
    }

    const exchangeRate = Number(data.exchange_rate ?? 1);

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new BadRequestException('Exchange rate must be greater than zero');
    }

    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager
        .getRepository(Supplier)
        .findOne({ where: { id: data.supplier_id } });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      const amount = roundMoney(data.amount);
      const nextKwdBalance =
        transactionCurrency === 'KWD'
          ? roundMoney(Number(supplier.balance_kwd ?? supplier.balance ?? 0) - amount)
          : roundMoney(Number(supplier.balance_kwd ?? supplier.balance ?? 0));
      const nextUsdBalance =
        transactionCurrency === 'USD'
          ? roundMoney(Number(supplier.balance_usd ?? 0) - amount)
          : roundMoney(Number(supplier.balance_usd ?? 0));

      const payment = await manager.getRepository(SupplierPayment).save({
        supplier_id: data.supplier_id,
        amount,
        transaction_currency: transactionCurrency,
        exchange_rate: roundMoney(exchangeRate),
        mode: data.mode,
        reference_no: data.reference_no?.trim() || null,
        note: data.note?.trim() || null,
        date: new Date().toISOString(),
      });

      supplier.balance_kwd = nextKwdBalance;
      supplier.balance_usd = nextUsdBalance;
      supplier.balance = nextKwdBalance;
      await manager.getRepository(Supplier).save(supplier);

      return {
        message: 'Supplier payment recorded',
        payment,
        supplier,
      };
    });
  }

  findAll() {
    return this.paymentRepo.find({ order: { date: 'DESC', id: 'DESC' } });
  }

  findBySupplier(supplierId: number) {
    return this.paymentRepo.find({
      where: { supplier_id: supplierId },
      order: { date: 'DESC', id: 'DESC' },
    });
  }
}
