import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  invoice_id?: number;

  @ApiProperty({ example: 200 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount: number;

  @ApiProperty({ example: 'cash', enum: ['cash', 'knet', 'card'] })
  @IsIn(['cash', 'knet', 'card'])
  mode: 'cash' | 'knet' | 'card';

  @ApiPropertyOptional({ example: 'TXN-1001' })
  @IsOptional()
  @IsString()
  reference?: string;
}
