import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class SaveInvoiceProfileDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  invoice_title: string;

  @IsOptional()
  @IsString()
  invoice_title_ar?: string;

  @IsString()
  @MinLength(1)
  company_name: string;

  @IsOptional()
  @IsString()
  company_name_ar?: string;

  @IsOptional()
  @IsString()
  company_activity?: string;

  @IsOptional()
  @IsString()
  company_activity_ar?: string;

  @IsString()
  @MinLength(1)
  company_address: string;

  @IsString()
  @MinLength(1)
  company_phone: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
