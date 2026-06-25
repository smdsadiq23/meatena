import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateShipmentDto {
  @ApiProperty({ example: 'Kenya Lamb Shipment - June 2026' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'SHIP-2026-06-01', required: false })
  @IsOptional()
  @IsString()
  reference_no?: string;

  @ApiProperty({ example: '2026-06-24', required: false })
  @IsOptional()
  @IsDateString()
  arrival_date?: string;

  @ApiProperty({ example: 'open', enum: ['open', 'closed'], required: false })
  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';
}
