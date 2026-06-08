import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from '../purchase/purchase.entity';
import { SupplierPayment } from '../supplier-payment/supplier-payment.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { Supplier } from './supplier.entity';

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
