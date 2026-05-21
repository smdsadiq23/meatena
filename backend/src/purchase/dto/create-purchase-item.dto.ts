import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CreatePurchaseItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({ example: 150 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  weight: number;

  @ApiProperty({ example: 2.2 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  cost_per_kg: number;
}
