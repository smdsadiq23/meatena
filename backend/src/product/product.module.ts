import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockMovement } from '../inventory/stock-movement.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { PurchaseItem } from '../purchase/purchase-item.entity';
import { ProductController } from './product.controller';
import { Product } from './product.entity';
import { ProductService } from './product.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, InvoiceItem, PurchaseItem, StockMovement])],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
