import { IsEmail, IsOptional, IsString, IsStrongPassword, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsStrongPassword()
  @IsOptional()
  password?: string;

  @IsString()
  @MaxLength(2048)
  @IsOptional()
  profile_image_url?: string;
}
