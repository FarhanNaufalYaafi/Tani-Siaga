import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateFarmerDto{
    @IsNotEmpty({ message: 'Nama Poktan tidak boleh kosong' })
    @IsString({ message: 'Nama Poktan harus berupa teks' })
    @MaxLength(150, { message: 'Nama Poktan maksimal 150 karakter' })
    name!: string;

    @IsOptional()
    @IsString({ message: 'Nomor registrasi Poktan harus berupa teks' })
    @MaxLength(50, { message: 'Nomor registrasi Poktan maksimal 50 karakter' })
    poktan_id?: string;

    @IsOptional()
    @IsString({ message: 'Alamat harus berupa teks' })
    address?: string;
}