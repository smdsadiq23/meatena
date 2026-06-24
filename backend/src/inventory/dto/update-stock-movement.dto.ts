import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateStockMovementDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  product_id?: number;

  @ApiProperty({
    example: 'sale',
    enum: ['purchase', 'sale', 'wastage', 'adjustment'],
    required: false,
  })
  @IsOptional()
  @IsIn(['purchase', 'sale', 'wastage', 'adjustment'])
  type?: 'purchase' | 'sale' | 'wastage' | 'adjustment';

  @ApiProperty({ example: 35, required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity_kg?: number;

  @ApiProperty({ example: 'Wrong entry corrected', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: '2026-06-24T17:30:00.000Z', required: false })
  @IsOptional()
  @IsISO8601()
  date?: string;
}
