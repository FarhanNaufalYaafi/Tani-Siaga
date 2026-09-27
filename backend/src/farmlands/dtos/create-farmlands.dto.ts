import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateFarmlandDto {
  @IsNotEmpty({ message: 'Nama lahan wajib diisi' })
  @IsString()
  name!: string;

  @IsNotEmpty({ message: 'Luas lahan wajib diisi' })
  @IsNumber()
  area_size!: number;

  @IsNotEmpty({ message: 'Kode ADM4 Desa/Kelurahan wajib diisi untuk data prediksi cuaca' })
  @IsString()
  adm4_code!: string;

  @IsOptional()
  @IsString()
  address_detail?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsDateString()
  @IsOptional()
  plant_date?: string;

  @IsString()
  @IsNotEmpty()
  plant_method!: string;

  @IsNumber()
  @IsOptional()
  commodity_id?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  custom_avg_harvest_days?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  custom_max_humidity_percentage?: number;

  @IsNumber()
  @IsOptional()
  custom_max_temp_celsius?: number;

  @IsNumber()
  @IsOptional()
  custom_min_temp_celsius?: number;

  @IsNumber()
  @IsOptional()
  expected_yield_user_kg?: number;
}