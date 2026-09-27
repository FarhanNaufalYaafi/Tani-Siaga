import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ShippingMethod } from '../enum/shipping-method.enum';

export class CreateOrderDto {

  @IsNotEmpty()
  @IsString()
  recipient_name!: string;

  @IsNotEmpty()
  @IsString()
  recipient_phone_number!: string;

  @IsNotEmpty()
  @IsString()
  recipient_address!: string;

  @IsEnum(ShippingMethod, { message: 'Metode pengiriman tidak valid' })
  @IsNotEmpty()
  shipping_method!: ShippingMethod;
}