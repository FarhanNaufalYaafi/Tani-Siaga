import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator"

export class UpdateProductDto {
    @IsOptional()
    @IsString()
    name?: string

    @IsOptional()
    @IsNumber()
    price?: number

    @IsOptional()
    @IsNumber()
    stock?: number

    @IsOptional()
    @IsString()
    description?: string
    
    @IsOptional()
    @IsArray()
    image_url?: string[]

    @IsOptional()
    @IsBoolean()
    is_pre_order?: boolean;

    @IsOptional()
    @IsNumber()
    farmland_id?: number;

    @IsOptional()
    @IsInt()
    @Min(1, { message: 'Kuota PO minimal 1 Kg jika diisi.' })
    po_quota_kg?: number;
}
