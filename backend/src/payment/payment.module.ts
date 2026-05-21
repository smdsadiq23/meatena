import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Customer } from '../customer/customer.entity';
import { Invoice } from '../invoice/invoice.entity';
import { LedgerModule } from '../ledger/ledger.module';
import { KnetPaymentSession } from './knet-payment-session.entity';
import { MyFatoorahService } from './myfatoorah.service';
import { PaymentController } from './payment.controller';
import { Payment } from './payment.entity';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, KnetPaymentSession, Invoice, Customer]),
    LedgerModule,
    AuditModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, MyFatoorahService],
})
export class PaymentModule {}
