import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from '../purchase/purchase.entity';
import { SupplierPayment } from '../supplier-payment/supplier-payment.entity';
import { SupplierController } from './supplier.controller';
import { Supplier } from './supplier.entity';
import { SupplierService } from './supplier.service';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, Purchase, SupplierPayment])],
  controllers: [SupplierController],
  providers: [SupplierService],
})
export class SupplierModule {}
