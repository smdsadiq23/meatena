import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { Product } from '../product/product.entity';
import { PurchaseItem } from '../purchase/purchase-item.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockMovement } from './stock-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      StockMovement,
      PurchaseItem,
      Invoice,
      InvoiceItem,
    ]),
    AuditModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
