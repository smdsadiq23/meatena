import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateShiftCloseDto {
  @ApiProperty({ example: '2026-05-11' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 125.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  counted_cash: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  counted_knet?: number;

  @ApiPropertyOptional({ example: 'Cash handed to admin at 10 PM' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;
}
