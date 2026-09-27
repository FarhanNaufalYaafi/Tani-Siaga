import {
  Injectable,
  Logger,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';

export interface WeatherForecast {
  datetime: string;
  temperature: number;
  humidity: number;
  weather_code: string;
  weather_name: string;
  precipitation: number;
  cloud_cover: number;
  wind_speed: number;
  wind_direction: string;
}

@Injectable()
export class BmkgService {
  private readonly logger = new Logger(BmkgService.name);

  private readonly bmkgApiUrl =
    'https://api.bmkg.go.id/publik/prakiraan-cuaca';

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getWeatherForecast(
    adm4: string,
  ): Promise<WeatherForecast[]> {
    if (!adm4) {
      throw new HttpException(
        'ADM4 wajib diisi.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const cacheKey = `bmkg_weather_${adm4}`;

    try {
      const cachedData =
        await this.cacheManager.get<WeatherForecast[]>(
          cacheKey,
        );

      if (
        cachedData &&
        cachedData.length > 0
      ) {
        this.logger.debug(
          `Cache HIT untuk ADM4 ${adm4}`,
        );

        return cachedData;
      }
    } catch (error: any) {
      this.logger.warn(
        `Gagal membaca cache: ${error?.message}`,
      );
    }

    try {
      this.logger.debug(
        `Request BMKG: ${this.bmkgApiUrl}?adm4=${adm4}`,
      );

      const response = await firstValueFrom(
        this.httpService.get(
          this.bmkgApiUrl,
          {
            params: {
              adm4,
            },
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
              Accept:
                'application/json, text/plain, */*',
              'Accept-Language':
                'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
              Referer:
                'https://www.bmkg.go.id/',
              Origin:
                'https://www.bmkg.go.id',
              Connection:
                'keep-alive',
            },
            timeout: 15000,
            validateStatus: () => true,
          },
        ),
      );

      this.logger.debug(
        `BMKG HTTP status: ${response.status}`,
      );

      if (
        response.status < 200 ||
        response.status >= 300
      ) {
        this.logger.error(
          `BMKG response: ${JSON.stringify(
            response.data,
          )}`,
        );

        throw new HttpException(
          `BMKG mengembalikan HTTP ${response.status}.`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const forecasts =
        this.parseBmkgJsonResponse(
          response.data,
        );

      this.logger.debug(
        `Jumlah forecast: ${forecasts.length}`,
      );

      if (forecasts.length === 0) {
        throw new HttpException(
          `Data cuaca untuk ADM4 ${adm4} kosong.`,
          HttpStatus.NOT_FOUND,
        );
      }

      try {
        await this.cacheManager.set(
          cacheKey,
          forecasts,
          3600000,
        );
      } catch (error: any) {
        this.logger.warn(
          `Gagal menyimpan cache: ${error?.message}`,
        );
      }

      return forecasts;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Request BMKG gagal untuk ADM4 ${adm4}`,
      );

      this.logger.error(
        `Error message: ${error?.message}`,
      );

      this.logger.error(
        `Error code: ${error?.code}`,
      );

      if (error?.response) {
        this.logger.error(
          `Axios status: ${error.response.status}`,
        );

        this.logger.error(
          `Axios response: ${JSON.stringify(
            error.response.data,
          )}`,
        );
      }

      throw new HttpException(
        `Gagal mengakses API BMKG: ${
          error?.message ??
          'Unknown error'
        }`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private parseBmkgJsonResponse(
    data: any,
  ): WeatherForecast[] {
    if (!data) {
      this.logger.error(
        'Response BMKG kosong.',
      );

      return [];
    }

    if (!Array.isArray(data.data)) {
      this.logger.error(
        'Response BMKG tidak memiliki data[].',
      );

      return [];
    }

    if (!data.data[0]) {
      this.logger.error(
        'data[0] BMKG tidak tersedia.',
      );

      return [];
    }

    if (
      !Array.isArray(
        data.data[0].cuaca,
      )
    ) {
      this.logger.error(
        'data[0].cuaca bukan array.',
      );

      return [];
    }

    const lokasi =
      data.data[0].lokasi;

    if (lokasi) {
      this.logger.debug(
        `BMKG lokasi: ${lokasi.desa}, ${lokasi.kecamatan}, ${lokasi.kotkab}`,
      );

      this.logger.debug(
        `BMKG ADM4: ${lokasi.adm4}`,
      );
    }

    const cuaca =
      data.data[0].cuaca.flat();

    return cuaca.map(
      (item: any): WeatherForecast => ({
        datetime:
          item.local_datetime ??
          item.datetime ??
          '',

        temperature:
          Number(item.t) || 0,

        humidity:
          Number(item.hu) || 0,

        weather_code:
          String(
            item.weather ?? '',
          ),

        weather_name:
          item.weather_desc ??
          item.weather_desc_en ??
          'Tidak Diketahui',

        precipitation:
          Number(item.tp) || 0,

        cloud_cover:
          Number(item.tcc) || 0,

        wind_speed:
          Number(item.ws) || 0,

        wind_direction:
          item.wd ?? '',
      }),
    );
  }
}