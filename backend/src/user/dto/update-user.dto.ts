import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../user-role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn([UserRole.Admin, UserRole.Staff])
  role?: UserRole;
}
