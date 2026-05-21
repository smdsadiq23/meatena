import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Payment } from '../payment/payment.entity';
import { ShiftCloseController } from './shift-close.controller';
import { ShiftClose } from './shift-close.entity';
import { ShiftCloseService } from './shift-close.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShiftClose, Payment]), AuditModule],
  controllers: [ShiftCloseController],
  providers: [ShiftCloseService],
})
export class ShiftCloseModule {}
