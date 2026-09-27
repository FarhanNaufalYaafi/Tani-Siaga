import { IsNotEmpty, IsString } from 'class-validator';

export class UnregisterTokenDto {
  @IsNotEmpty()
  @IsString()
  fcmToken!: string;
}
