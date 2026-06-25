import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingModule } from '../app-setting/app-setting.module';
import { Customer } from '../customer/customer.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { Ledger } from './ledger.entity';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ledger, Customer, InvoiceItem]), AppSettingModule],
  providers: [LedgerService],
  exports: [LedgerService],
  controllers: [LedgerController],
})
export class LedgerModule {}
