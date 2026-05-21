import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class VoidInvoiceDto {
  @ApiPropertyOptional({ example: 'Wrong customer selected' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  reason?: string;
}
