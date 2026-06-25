import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Shop rent' })
  @IsString()
  title: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  shipment_id?: number;

  @ApiProperty({ example: 250.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount: number;

  @ApiProperty({
    example: 'rent',
    enum: ['rent', 'salary', 'fuel', 'transport', 'misc'],
  })
  @IsIn(['rent', 'salary', 'fuel', 'transport', 'misc'])
  category: 'rent' | 'salary' | 'fuel' | 'transport' | 'misc';
}
