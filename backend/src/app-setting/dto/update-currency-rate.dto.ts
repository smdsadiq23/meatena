import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateCurrencyRateDto {
  @ApiProperty({ example: 3.25 })
  @IsNumber()
  @Min(0.001)
  @Max(999)
  kwd_to_usd_rate: number;
}
