import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export class RegisterTokenDto {
  @IsNotEmpty()
  @IsString()
  fcmToken!: string;

  @IsNotEmpty()
  @IsEnum(['android', 'ios', 'web'])
  deviceType!: string;
}