import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Halaman (page) harus berupa angka bulat' })
  @Min(1, { message: 'Halaman (page) minimal bernilai 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Batas data (limit) harus berupa angka bulat' })
  @Min(1, { message: 'Batas data (limit) minimal bernilai 1' })
  limit?: number = 10;
}