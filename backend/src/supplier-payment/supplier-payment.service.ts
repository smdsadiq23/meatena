import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Supplier } from '../supplier/supplier.entity';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { SupplierPayment } from './supplier-payment.entity';

@Injectable()
export class SupplierPaymentService {
  constructor(
    @InjectRepository(SupplierPayment)
    private readonly paymentRepo: Repository<SupplierPayment>,
    private readonly dataSource: DataSource,
  ) {}

  create(data: CreateSupplierPaymentDto) {
    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager
        .getRepository(Supplier)
        .findOne({ where: { id: data.supplier_id } });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      const amount = roundMoney(data.amount);
      const nextBalance = roundMoney(Number(supplier.balance) - amount);

      if (nextBalance < 0) {
        throw new BadRequestException('Payment exceeds supplier balance');
      }

      const payment = await manager.getRepository(SupplierPayment).save({
        supplier_id: data.supplier_id,
        amount,
        mode: data.mode,
        reference_no: data.reference_no?.trim() || null,
        note: data.note?.trim() || null,
        date: new Date().toISOString(),
      });

      supplier.balance = nextBalance;
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
