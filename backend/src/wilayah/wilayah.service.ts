import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WilayahService {
  private readonly logger = new Logger(WilayahService.name);
  
                                                               
  private readonly baseUrl = 'https://wilayah.id/api';

  constructor(private readonly httpService: HttpService) {}

  async getProvinces() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/provinces.json`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
      );
      return response.data.data; // Response terbungkus dalam properti "data"
    } catch (error: any) {
      this.logger.error(`Gagal mengambil data provinsi: ${error.message}`);
      throw new HttpException('Gagal mengambil data provinsi', HttpStatus.BAD_REQUEST);
    }
  }

  async getRegencies(provinceCode: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/regencies/${provinceCode}.json`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
      );
      return response.data.data;
    } catch (error: any) {
      this.logger.error(`Gagal mengambil data kabupaten/kota: ${error.message}`);
      throw new HttpException('Gagal mengambil data kabupaten/kota', HttpStatus.BAD_REQUEST);
    }
  }

  async getDistricts(regencyCode: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/districts/${regencyCode}.json`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
      );
      return response.data.data;
    } catch (error: any) {
      this.logger.error(`Gagal mengambil data kecamatan: ${error.message}`);
      throw new HttpException('Gagal mengambil data kecamatan', HttpStatus.BAD_REQUEST);
    }
  }

  async getVillages(districtCode: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/villages/${districtCode}.json`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
      );
      return response.data.data;
    } catch (error: any) {
      this.logger.error(`Gagal mengambil data desa/kelurahan: ${error.message}`);
      throw new HttpException('Gagal mengambil data desa/kelurahan', HttpStatus.BAD_REQUEST);
    }
  }
}