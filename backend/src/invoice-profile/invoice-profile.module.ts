import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceProfileController } from './invoice-profile.controller';
import { InvoiceProfile } from './invoice-profile.entity';
import { InvoiceProfileService } from './invoice-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceProfile])],
  controllers: [InvoiceProfileController],
  providers: [InvoiceProfileService],
})
export class InvoiceProfileModule {}
