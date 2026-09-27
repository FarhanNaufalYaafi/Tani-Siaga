import { IsEmail, IsString, IsStrongPassword, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsStrongPassword()
  password!: string;

  @IsString()
  confirmPassword!: string;
}