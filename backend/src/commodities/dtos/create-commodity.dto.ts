import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class CreateCommodityDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  variety?: string; 

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  avg_harvest_days!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  max_humidity_percentage!: number;

  @IsNumber()
  @IsNotEmpty()
  max_temp_celsius!: number;

  @IsNumber()
  @IsNotEmpty()
  min_temp_celsius!: number;
}