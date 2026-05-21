import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Kuwait Meat Imports' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: '96684998', required: false })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiProperty({ example: 'Shuwaikh', required: false })
  @IsOptional()
  @IsString()
  address?: string;
}
