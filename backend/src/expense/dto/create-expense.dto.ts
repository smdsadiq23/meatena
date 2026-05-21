import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Shop rent' })
  @IsString()
  title: string;

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
