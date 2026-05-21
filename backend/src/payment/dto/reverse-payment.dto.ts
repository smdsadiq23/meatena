import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class ReversePaymentDto {
  @ApiPropertyOptional({ example: 'Wrong invoice selected' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  reason?: string;
}
