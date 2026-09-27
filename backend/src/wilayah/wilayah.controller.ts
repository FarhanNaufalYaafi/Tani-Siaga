import { Controller, Get, Param } from '@nestjs/common';
import { WilayahService } from './wilayah.service';

@Controller('wilayah')
export class WilayahController {
  constructor(private readonly wilayahService: WilayahService) {}

  @Get('provinces')
  async getProvinces() {
    return this.wilayahService.getProvinces();
  }

  @Get('regencies/:provinceCode')
  async getRegencies(@Param('provinceCode') provinceCode: string) {
    return this.wilayahService.getRegencies(provinceCode);
  }

  @Get('districts/:regencyCode')
  async getDistricts(@Param('regencyCode') regencyCode: string) {
    return this.wilayahService.getDistricts(regencyCode);
  }

  @Get('villages/:districtCode')
  async getVillages(@Param('districtCode') districtCode: string) {
    return this.wilayahService.getVillages(districtCode);
  }
}