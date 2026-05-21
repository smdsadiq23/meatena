import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateInvoiceItemDto } from './create-invoice-item.dto';

export class CreateInvoiceDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id: number;

  @ApiProperty({ example: 'credit', enum: ['cash', 'credit'] })
  @IsIn(['cash', 'credit'])
  type: 'cash' | 'credit';

  @ApiProperty({ example: 'INV-2026-001' })
  @IsString()
  @MinLength(1)
  invoice_number: string;

  @ApiProperty({ example: 'Invoice (Cash / Credit)' })
  @IsString()
  @MinLength(1)
  invoice_title: string;

  @ApiProperty({ example: 'فاتورة نقدية / الحساب', required: false })
  @IsOptional()
  @IsString()
  invoice_title_ar?: string;

  @ApiProperty({ example: 'Meatena Butchery Operations' })
  @IsString()
  @MinLength(1)
  company_name: string;

  @ApiProperty({ example: 'شركة ميتينا للحوم', required: false })
  @IsOptional()
  @IsString()
  company_name_ar?: string;

  @ApiProperty({ example: 'Meat supply and butchery operations', required: false })
  @IsOptional()
  @IsString()
  company_activity?: string;

  @ApiProperty({ example: 'توريد وبيع اللحوم', required: false })
  @IsOptional()
  @IsString()
  company_activity_ar?: string;

  @ApiProperty({ example: 'Shuwaikh Industrial Area, Kuwait' })
  @IsString()
  @MinLength(1)
  company_address: string;

  @ApiProperty({ example: '96684998 / 94942708' })
  @IsString()
  @MinLength(1)
  company_phone: string;

  @ApiProperty({ example: 'almajad.albasat.co@gmail.com', required: false })
  @IsOptional()
  @IsString()
  company_email?: string;

  @ApiProperty({ example: 'Abdul Basit, Zahoor Ellahi', required: false })
  @IsOptional()
  @IsString()
  contact_names?: string;

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
