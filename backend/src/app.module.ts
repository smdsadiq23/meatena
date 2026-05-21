import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppSettingModule } from './app-setting/app-setting.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customer/customer.module';
import { billingEntities } from './database/entities';
import { ExpenseModule } from './expense/expense.module';
import { InventoryModule } from './inventory/inventory.module';
import { LedgerModule } from './ledger/ledger.module';
import { InvoiceModule } from './invoice/invoice.module';
import { InvoiceProfileModule } from './invoice-profile/invoice-profile.module';
import { PaymentModule } from './payment/payment.module';
import { ProductModule } from './product/product.module';
import { PurchaseModule } from './purchase/purchase.module';
import { ShiftCloseModule } from './shift-close/shift-close.module';
import { SupplierPaymentModule } from './supplier-payment/supplier-payment.module';
import { SupplierModule } from './supplier/supplier.module';
import { UserModule } from './user/user.module';

const throttlerTtl = Number(process.env.THROTTLE_TTL_MS ?? 60000);
const throttlerLimit = Number(process.env.THROTTLE_LIMIT ?? 300);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: throttlerTtl,
        limit: throttlerLimit,
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: billingEntities,
      synchronize: false,
    }),
    AuthModule,
    AppSettingModule,
    AuditModule,
    UserModule,
    CustomerModule,
    ProductModule,
    InvoiceProfileModule,
    InvoiceModule,
    PaymentModule,
    LedgerModule,
    ExpenseModule,
    InventoryModule,
    SupplierModule,
    SupplierPaymentModule,
    PurchaseModule,
    ShiftCloseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
