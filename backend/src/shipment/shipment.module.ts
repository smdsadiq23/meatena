import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from '../expense/expense.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Purchase } from '../purchase/purchase.entity';
import { ShipmentController } from './shipment.controller';
import { Shipment } from './shipment.entity';
import { ShipmentService } from './shipment.service';

@Module({
  imports: [TypeOrmModule.forFeature([Shipment, Purchase, Invoice, Expense])],
  controllers: [ShipmentController],
  providers: [ShipmentService],
})
export class ShipmentModule {}
