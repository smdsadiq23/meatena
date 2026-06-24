import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreatePurchaseItemDto } from './create-purchase-item.dto';

export class CreatePurchaseDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  supplier_id: number;

  @ApiProperty({ example: 'SUP-1001', required: false })
  @IsOptional()
  @IsString()
  invoice_no?: string;

  @ApiProperty({ example: '2026-06-24', required: false })
  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @ApiProperty({ example: '2026-06-24', required: false })
  @IsOptional()
  @IsDateString()
  goods_received_date?: string;

  @ApiProperty({ example: 'KWD', enum: ['KWD', 'USD'], required: false })
  @IsOptional()
  @IsIn(['KWD', 'USD'])
  transaction_currency?: 'KWD' | 'USD';

  @ApiProperty({ example: 3.25, required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  exchange_rate?: number;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  discount_amount?: number;

  @ApiProperty({ example: 5, required: false, deprecated: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  discount_percent?: number;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  advance_paid?: number;

  @ApiProperty({ type: [CreatePurchaseItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];
}
