import { IsString, IsStrongPassword, Length } from 'class-validator';

export class ChangeProfilePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsStrongPassword()
  password!: string;

  @IsString()
  confirmPassword!: string;
}