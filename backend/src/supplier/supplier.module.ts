import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingModule } from '../app-setting/app-setting.module';
import { Customer } from '../customer/customer.entity';
import { Expense } from '../expense/expense.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Product } from '../product/product.entity';
import { PurchaseItem } from '../purchase/purchase-item.entity';
import { Purchase } from '../purchase/purchase.entity';
import { Shipment } from '../shipment/shipment.entity';
import { SupplierPayment } from '../supplier-payment/supplier-payment.entity';
import { SupplierController } from './supplier.controller';
import { Supplier } from './supplier.entity';
import { SupplierService } from './supplier.service';

@Module({
  imports: [
    AppSettingModule,
    TypeOrmModule.forFeature([
      Supplier,
      Purchase,
      PurchaseItem,
      SupplierPayment,
      Shipment,
      Invoice,
      InvoiceItem,
      Expense,
      Product,
      Customer,
    ]),
  ],
  controllers: [SupplierController],
  providers: [SupplierService],
})
export class SupplierModule {}
