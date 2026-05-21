import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class ReviewShiftCloseDto {
  @ApiPropertyOptional({ example: 'Verified against cash drawer' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;
}
