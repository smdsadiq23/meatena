import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReverseStockMovementDto {
  @ApiProperty({
    example: 'Wrong sale entry, corrected by admin',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
