import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class ShopWarningDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUrl({}, { each: true })
  @MaxLength(2048, { each: true })
  evidence_urls?: string[];
}

export class ShopSanctionDto extends ShopWarningDto {
  @IsInt()
  @Min(1)
  @Max(365)
  duration_days!: number;
}
