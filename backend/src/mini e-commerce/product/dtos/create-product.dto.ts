import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator"

export class CreateProductDto {
    @IsString()
    name!: string

    @IsNumber()
    price!: number

    @IsOptional()
    @IsNumber()
    stock?: number

    @IsString()
    description!: string
    
    @IsArray()
    image_url!: string[]

    @IsBoolean()
    @IsOptional()
    is_pre_order?: boolean;                                                          

    @IsNumber()
    @IsOptional()
    farmland_id?: number;                                  

    @IsOptional()
    @IsInt()
    @Min(1, { message: 'Kuota PO minimal 1 Kg jika diisi manual.' })
    po_quota_kg?: number;
}