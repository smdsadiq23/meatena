import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { SupplierPaymentController } from './supplier-payment.controller';
import { SupplierPayment } from './supplier-payment.entity';
import { SupplierPaymentService } from './supplier-payment.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupplierPayment]), AuditModule],
  controllers: [SupplierPaymentController],
  providers: [SupplierPaymentService],
})
export class SupplierPaymentModule {}
