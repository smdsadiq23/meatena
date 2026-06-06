import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePurchaseItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({ example: 150 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  weight: number;

  @ApiProperty({ example: 8, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  pieces?: number;

  @ApiProperty({ example: 2.2 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  cost_per_kg: number;
}
