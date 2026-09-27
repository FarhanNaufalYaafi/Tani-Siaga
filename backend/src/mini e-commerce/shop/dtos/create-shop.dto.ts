import { IsNotEmpty, IsPhoneNumber, IsString, MaxLength, MinLength } from "class-validator"

export class CreateShopDto{
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    @IsNotEmpty()
    name!: string

    @IsString()
    @MinLength(20)
    @MaxLength(1500)
    description!: string
    
    @IsString()
    @MinLength(10)
    @MaxLength(500)
    @IsNotEmpty()
    location!: string

    @IsPhoneNumber('ID', { message: 'Nomor telepon toko harus berupa nomor Indonesia yang valid' })
    @IsNotEmpty({ message: 'Nomor telepon toko wajib diisi' })
    phone_number!: string;
}