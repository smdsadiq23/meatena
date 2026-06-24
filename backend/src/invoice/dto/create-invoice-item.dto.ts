import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  product_id?: number;

  @ApiProperty({ example: 100 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  weight: number;

  @ApiProperty({ example: 12, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  pieces?: number;

  @ApiProperty({ example: 3.15 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  price_per_kg: number;

  @ApiProperty({ example: 1.5, required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  discount_amount?: number;
}
