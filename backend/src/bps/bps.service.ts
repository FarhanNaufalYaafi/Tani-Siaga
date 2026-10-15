import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { load } from 'cheerio';

export interface BpsRegionalBaseline {
  domain: string;
  table_id: number;
  table_title: string;
  province_code: string;
  data_fetched_at: string;
  production_by_year: { year: number; value: number }[];
}

interface BpsListPage {
  totalPages: number;
  items: any[];
}

@Injectable()
export class BpsService {
  private readonly logger = new Logger(BpsService.name);
  private readonly bpsApiKey: string;
  private readonly baseUrl = 'https://webapi.bps.go.id/v1/api';
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000;

  private readonly cache = new Map<
    string,
    { timestamp: number; data: BpsRegionalBaseline }
  >();
  private readonly dynamicVariableCache = new Map<
    string,
    { timestamp: number; variables: any[] }
  >();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.bpsApiKey = this.configService.get<string>('BPS_API_KEY') || '';
  }

     
                                                                 
                                                                       
                                                                     
     
  async getRegionalAgriculturalBaseline(
    provinceCode: string,
    commodityName: string,
  ): Promise<BpsRegionalBaseline | null> {
    if (!provinceCode || !commodityName || !this.bpsApiKey) return null;

    const bpsDomain = `${provinceCode}00`;
    const cacheKey = `bps_${bpsDomain}_commodity_${commodityName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const dynamicBaseline = await this.fetchDynamicProductionBaseline(
      bpsDomain,
      provinceCode,
      commodityName,
    );
    if (dynamicBaseline) {
      this.cache.set(cacheKey, { timestamp: Date.now(), data: dynamicBaseline });
      return dynamicBaseline;
    }

    const tables = await this.fetchBpsTableList(
      bpsDomain,
      `produksi ${commodityName}`,
    );

    const normalizedCommodity = this.normalizeText(commodityName);
    const candidates = (tables || [])
      .filter((table) => {
        const title = this.normalizeText(table.title || '');
        return (
          title.includes(normalizedCommodity) &&
          /\bproduksi\b/.test(title) &&
          Number.isFinite(Number(table.table_id))
        );
      })
      .sort(
        (left, right) =>
          new Date(right.updt_date || 0).getTime() -
          new Date(left.updt_date || 0).getTime(),
      );

    for (const table of candidates) {
      const detail = await this.fetchBpsTableDetail(
        bpsDomain,
        Number(table.table_id),
      );
      if (!detail?.table) continue;

      const productionByYear = this.parseProvinceProduction(detail.table);
      const latestYear = productionByYear.at(-1)?.year;
      if (
        productionByYear.length < 2 ||
        !latestYear ||
        latestYear < new Date().getFullYear() - 5
      ) {
        continue;
      }

      const baseline: BpsRegionalBaseline = {
        domain: bpsDomain,
        table_id: Number(table.table_id),
        table_title: detail.title || table.title,
        province_code: provinceCode,
        data_fetched_at: new Date().toISOString(),
        production_by_year: productionByYear,
      };
      this.cache.set(cacheKey, { timestamp: Date.now(), data: baseline });
      return baseline;
    }

    this.logger.warn(
      `[BPS Service] Tidak ditemukan data produksi terbaru yang terstruktur untuk ${commodityName} di domain ${bpsDomain}.`,
    );
    return null;
  }

  private async fetchDynamicProductionBaseline(
    domain: string,
    provinceCode: string,
    commodityName: string,
  ): Promise<BpsRegionalBaseline | null> {
    const variables = await this.getAgriculturalVariables(domain);
    const normalizedCommodity = this.normalizeText(commodityName);
    const candidates = variables.filter((variable) => {
      const title = this.normalizeText(variable.title || '');
      return title.includes(normalizedCommodity) && /\bproduksi\b/.test(title);
    });

    for (const variable of candidates) {
      const periods = await this.fetchBpsListPage(
        `${this.baseUrl}/list/model/th/domain/${domain}/var/${variable.var_id}/page/1/key/${this.bpsApiKey}/`,
      );
      if (!periods?.items.length) continue;

      const availablePeriods = periods.items
        .map((period) => ({
          id: Number(period.th_id),
          year: Number(period.th),
        }))
        .filter((period) => Number.isFinite(period.id) && Number.isFinite(period.year))
        .sort((left, right) => right.year - left.year)
        .slice(0, 4);
      if (
        availablePeriods.length < 2 ||
        availablePeriods[0].year < new Date().getFullYear() - 5
      ) {
        continue;
      }

      const categories = await this.fetchBpsListPage(
        `${this.baseUrl}/list/model/turvar/domain/${domain}/var/${variable.var_id}/page/1/key/${this.bpsApiKey}/`,
      );
      let selectedCategory: any;
      if (categories?.items.length) {
        selectedCategory = categories.items.find((category) =>
          this.normalizeText(category.turvar || '').includes(normalizedCommodity),
        );
        if (!selectedCategory) continue;
      }

      const productionByYear = await Promise.all(
        availablePeriods.map(async (period) => {
          const categoryPath = selectedCategory
            ? `/turvar/${selectedCategory.turvar_id}`
            : '';
          const url = `${this.baseUrl}/list/model/data/domain/${domain}/var/${variable.var_id}${categoryPath}/th/${period.id}/key/${this.bpsApiKey}/`;
          try {
            const response = await firstValueFrom(
              this.httpService.get(url, { timeout: 10000 }),
            );
            const body = response.data;
            if (
              body?.status !== 'OK' ||
              body?.['data-availability'] !== 'available' ||
              !body?.datacontent
            ) {
              return null;
            }

            const province = body.vervar?.find(
              (item: any) => Number(item.val) === Number(domain),
            );
            if (!province) return null;

            const provinceValue = Object.entries(body.datacontent).find(
              ([key]) => key.startsWith(String(province.val)),
            )?.[1];
            const value = Number(provinceValue);
            return Number.isFinite(value) ? { year: period.year, value } : null;
          } catch (error: any) {
            this.logger.warn(
              `[BPS Service] Gagal mengambil data dinamis ${variable.var_id} tahun ${period.year}: ${error.message}`,
            );
            return null;
          }
        }),
      );

      const observations = productionByYear
        .filter((item): item is { year: number; value: number } => item !== null)
        .sort((left, right) => left.year - right.year);
      if (observations.length < 2) continue;

      return {
        domain,
        table_id: Number(variable.var_id),
        table_title: variable.title,
        province_code: provinceCode,
        data_fetched_at: new Date().toISOString(),
        production_by_year: observations,
      };
    }

    return null;
  }

  private async getAgriculturalVariables(domain: string): Promise<any[]> {
    const cached = this.dynamicVariableCache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.variables;
    }

    const firstPage = await this.fetchBpsListPage(
      `${this.baseUrl}/list/model/subject/domain/${domain}/page/1/key/${this.bpsApiKey}/`,
    );
    if (!firstPage) return [];

    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
        this.fetchBpsListPage(
          `${this.baseUrl}/list/model/subject/domain/${domain}/page/${index + 2}/key/${this.bpsApiKey}/`,
        ),
      ),
    );
    const subjects = [firstPage, ...remainingPages]
      .flatMap((page) => page?.items || [])
      .filter((subject) =>
        this.normalizeText(subject.subcat || '').includes('pertanian'),
      );

    const variablePages = await Promise.all(
      subjects.map(async (subject) => {
        const firstVariablePage = await this.fetchBpsListPage(
          `${this.baseUrl}/list/model/var/domain/${domain}/subject/${subject.sub_id}/page/1/key/${this.bpsApiKey}/`,
        );
        if (!firstVariablePage) return [];

        const remainingVariablePages = await Promise.all(
          Array.from(
            { length: Math.max(0, firstVariablePage.totalPages - 1) },
            (_, index) =>
              this.fetchBpsListPage(
                `${this.baseUrl}/list/model/var/domain/${domain}/subject/${subject.sub_id}/page/${index + 2}/key/${this.bpsApiKey}/`,
              ),
          ),
        );
        return [firstVariablePage, ...remainingVariablePages].flatMap(
          (page) => page?.items || [],
        );
      }),
    );
    const variables = variablePages.flat();
    this.dynamicVariableCache.set(domain, {
      timestamp: Date.now(),
      variables,
    });
    return variables;
  }

  private async fetchBpsListPage(url: string): Promise<BpsListPage | null> {
    try {
      const response = await firstValueFrom(this.httpService.get(url, { timeout: 10000 }));
      const body = response.data;
      if (
        body?.status !== 'OK' ||
        body?.['data-availability'] !== 'available' ||
        !Array.isArray(body?.data) ||
        !Array.isArray(body.data[1])
      ) {
        return null;
      }
      return {
        totalPages: Number(body.data[0]?.pages) || 1,
        items: body.data[1],
      };
    } catch (error: any) {
      this.logger.debug(`[BPS Service] Gagal mengambil daftar dinamis: ${error.message}`);
      return null;
    }
  }

  private async fetchBpsTableList(
    domain: string,
    keyword: string,
  ): Promise<any[] | null> {
    const url = `${this.baseUrl}/list/model/statictable/domain/${domain}/keyword/${encodeURIComponent(keyword)}/key/${this.bpsApiKey}/`;

    try {
      const response = await firstValueFrom(this.httpService.get(url, { timeout: 10000 }));
      const body = response.data;
      if (
        body?.status === 'OK' &&
        body?.['data-availability'] === 'available' &&
        Array.isArray(body?.data) &&
        Array.isArray(body?.data[1]) &&
        body.data[1].length > 0
      ) {
        return body.data[1];
      }
      return null;
    } catch (error: any) {
      this.logger.error(`[BPS Service] Gagal fetch domain ${domain}: ${error.message}`);
      return null;
    }
  }

  private async fetchBpsTableDetail(
    domain: string,
    tableId: number,
  ): Promise<{ title?: string; table?: string } | null> {
    const url = `${this.baseUrl}/view/model/statictable/domain/${domain}/id/${tableId}/lang/ind/key/${this.bpsApiKey}/`;

    try {
      const response = await firstValueFrom(this.httpService.get(url, { timeout: 10000 }));
      const body = response.data;
      if (
        body?.status !== 'OK' ||
        body?.['data-availability'] !== 'available' ||
        typeof body?.data?.table !== 'string'
      ) {
        return null;
      }
      return { title: body.data.title, table: body.data.table };
    } catch (error: any) {
      this.logger.error(`[BPS Service] Gagal mengambil detail tabel ${tableId}: ${error.message}`);
      return null;
    }
  }

  private parseProvinceProduction(
    encodedTable: string,
  ): { year: number; value: number }[] {
    const markup = load(encodedTable).text();
    const document = load(markup);
    const rows = document('tr')
      .toArray()
      .map((row) =>
        document(row)
          .find('th, td')
          .toArray()
          .map((cell) => document(cell).text().replace(/\s+/g, ' ').trim()),
      )
      .filter((cells) => cells.length > 0);

    const header = rows.find(
      (cells) => cells.filter((cell) => /^(19|20)\d{2}$/.test(cell)).length >= 2,
    );
    if (!header) return [];

    const years = header
      .filter((cell) => /^(19|20)\d{2}$/.test(cell))
      .map(Number);
    const provinceRow = rows.find((cells) => {
      const regionLabel = cells.slice(0, -years.length).join(' ').trim();
      return /^provinsi(?:\s|$)/i.test(regionLabel);
    });
    if (!provinceRow) return [];

    return years
      .map((year, index) => ({
        year,
        value: this.parseIndonesianNumber(
          provinceRow[provinceRow.length - years.length + index],
        ),
      }))
      .filter((item): item is { year: number; value: number } => item.value !== null)
      .sort((left, right) => left.year - right.year);
  }

  private parseIndonesianNumber(value: string | undefined): number | null {
    if (!value || !/\d/.test(value)) return null;
    const normalized = value.includes(',')
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(/\./g, '');
    const parsed = Number(normalized.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}