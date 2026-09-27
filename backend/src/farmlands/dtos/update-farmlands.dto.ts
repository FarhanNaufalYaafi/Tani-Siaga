import { PartialType } from '@nestjs/mapped-types';
import { CreateFarmlandDto } from './create-farmlands.dto';

export class UpdateFarmlandDto extends PartialType(CreateFarmlandDto) {}