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
