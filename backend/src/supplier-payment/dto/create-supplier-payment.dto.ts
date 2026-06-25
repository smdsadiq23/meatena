import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSupplierPaymentDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  supplier_id: number;

  @ApiProperty({ example: 125.75 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount: number;

  @ApiProperty({ example: 'KWD', enum: ['KWD', 'USD'], required: false })
  @IsOptional()
  @IsIn(['KWD', 'USD'])
  transaction_currency?: 'KWD' | 'USD';

  @ApiProperty({ example: 3.25, required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchange_rate?: number;

  @ApiProperty({ example: 'cash', enum: ['cash', 'bank', 'knet', 'other'] })
  @IsIn(['cash', 'bank', 'knet', 'other'])
  mode: 'cash' | 'bank' | 'knet' | 'other';

  @ApiProperty({ example: 'BNK-9483', required: false })
  @IsOptional()
  @IsString()
  reference_no?: string;

  @ApiProperty({ example: 'Settled weekly purchase balance', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
