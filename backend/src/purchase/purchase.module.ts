import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AppSettingModule } from '../app-setting/app-setting.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchaseItem } from './purchase-item.entity';
import { PurchaseController } from './purchase.controller';
import { Purchase } from './purchase.entity';
import { PurchaseService } from './purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, PurchaseItem]),
    InventoryModule,
    AuditModule,
    AppSettingModule,
  ],
  controllers: [PurchaseController],
  providers: [PurchaseService],
})
export class PurchaseModule {}
