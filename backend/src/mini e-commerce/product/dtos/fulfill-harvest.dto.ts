                                                          
import { IsNumber, Min } from 'class-validator';

export class FulfillHarvestDto {
  @IsNumber()
  @Min(0)
  actual_harvest_yield_kg!: number;                                                     
}