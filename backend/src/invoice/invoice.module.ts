import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AppSettingModule } from '../app-setting/app-setting.module';
import { Customer } from '../customer/customer.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { LedgerModule } from '../ledger/ledger.module';
import { Payment } from '../payment/payment.entity';
import { Product } from '../product/product.entity';
import { InvoiceController } from './invoice.controller';
import { InvoiceItem } from './invoice-item.entity';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      Customer,
      Payment,
      Product,
    ]),
    InventoryModule,
    LedgerModule,
    AuditModule,
    AppSettingModule,
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
})
export class InvoiceModule {}
