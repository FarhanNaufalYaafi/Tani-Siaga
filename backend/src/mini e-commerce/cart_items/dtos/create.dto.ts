import { IsInt, Min } from "class-validator";

export class CreateCartItemsDto {
    @IsInt()
    @Min(1, { message: 'Jumlah produk minimal 1.' })
    quantity!: number
}