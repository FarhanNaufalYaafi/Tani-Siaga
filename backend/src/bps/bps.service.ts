import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface BpsRegionalBaseline {
  domain: string;
  province_code: string;
  data_fetched_at: string;
  raw_indicators?: any[];
}

@Injectable()
export class BpsService {
  private readonly logger = new Logger(BpsService.name);
  private readonly bpsApiKey: string;
  private readonly baseUrl = 'https://webapi.bps.go.id/v1/api';

                                             
  private readonly cache = new Map<string, { timestamp: number; data: BpsRegionalBaseline }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;          

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.bpsApiKey = this.configService.get<string>('BPS_API_KEY') || '';
  }

     
                                                                 
                                                                       
                                                                     
     
  async getRegionalAgriculturalBaseline(
    provinceCode: string,
    keyword: string = 'pertanian',
  ): Promise<BpsRegionalBaseline | null> {
    if (!provinceCode) return null;

    const bpsDomain = `${provinceCode}00`;
    const cacheKey = `bps_${bpsDomain}_kw_${keyword}`;

    // 1. Cek dari Cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.debug(`[BPS Service] Cache HIT untuk domain ${bpsDomain}`);
      return cached.data;
    }

    // 2. Cek ketersediaan API Key
    if (!this.bpsApiKey) {
      this.logger.warn('[BPS Service] BPS_API_KEY belum dikonfigurasi di .env');
      return null;
    }

    // 3. Eksekusi Request dengan Fallback Domain
    let resultData = await this.fetchBpsApi(bpsDomain, keyword);

    // Jika domain daerah kosong, fallback ke domain BPS Pusat ('0000')
    if (!resultData && bpsDomain !== '0000') {
      this.logger.warn(`[BPS Service] Domain ${bpsDomain} kosong. Mencoba fallback ke BPS Pusat (0000)...`);
      resultData = await this.fetchBpsApi('0000', keyword);
    }

    if (!resultData || resultData.length === 0) {
      this.logger.warn(`[BPS Service] Data BPS tidak ditemukan untuk domain ${bpsDomain} maupun BPS Pusat.`);
      return null;
    }

    const baselineResult: BpsRegionalBaseline = {
      domain: bpsDomain,
      province_code: provinceCode,
      data_fetched_at: new Date().toISOString(),
      raw_indicators: resultData.slice(0, 5), // Ambil 5 tabel teratas yang paling relevan
    };

    // Simpan ke Cache
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      data: baselineResult,
    });

    return baselineResult;
  }

  /**
   * Helper internal untuk Fetch API BPS dan membaca struktur array data[1]
   */
  private async fetchBpsApi(domain: string, keyword: string): Promise<any[] | null> {
    const url = `${this.baseUrl}/list/model/statictable/domain/${domain}/keyword/${encodeURIComponent(
      keyword,
    )}/key/${this.bpsApiKey}/`;

    try {
      this.logger.log(`[BPS Service] Fetching data BPS: Domain ${domain} (Keyword: '${keyword}')...`);
      const response = await firstValueFrom(this.httpService.get(url, { timeout: 10000 }));
      const body = response.data;

      // VALIDASI PERBAIKAN:
      // BPS menyimpan metadata di body.data[0] dan array list tabel di body.data[1]
      if (
        body?.status === 'OK' &&
        body?.['data-availability'] === 'available' &&
        Array.isArray(body?.data) &&
        Array.isArray(body?.data[1]) &&
        body.data[1].length > 0
      ) {
        return body.data[1]; // Kembalikan array daftar tabel
      }

      return null;
    } catch (error: any) {
      this.logger.error(`[BPS Service] Gagal fetch domain ${domain}: ${error.message}`);
      return null;
    }
  }
}