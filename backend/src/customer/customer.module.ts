import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerController } from './customer.controller';
import { Customer } from './customer.entity';
import { CustomerService } from './customer.service';
import { Invoice } from '../invoice/invoice.entity';
import { Payment } from '../payment/payment.entity';
import { Ledger } from '../ledger/ledger.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Invoice, Payment, Ledger])],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
