import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
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
  @Max(100)
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
