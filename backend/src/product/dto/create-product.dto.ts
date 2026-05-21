import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Beef' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: 'BEEF-PK', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  sku?: string;

  @ApiProperty({ example: 3.15 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  price_per_kg: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  low_stock_kg?: number;
}
