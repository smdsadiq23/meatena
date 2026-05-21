import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockAdjustmentDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({ example: 'wastage', enum: ['wastage', 'adjustment'] })
  @IsIn(['wastage', 'adjustment'])
  type: 'wastage' | 'adjustment';

  @ApiProperty({ example: 2.5 })
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity_kg: number;

  @ApiProperty({ example: 'Trimming loss', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
