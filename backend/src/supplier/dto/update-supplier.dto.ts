import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
