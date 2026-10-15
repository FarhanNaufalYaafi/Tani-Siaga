import { describe, expect, it, jest } from '@jest/globals';
import { of } from 'rxjs';
import { BpsService } from './bps.service';

jest.mock('@nestjs/axios', () => ({ HttpService: class HttpService {} }));
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

describe('BpsService', () => {
  it('loads and parses fresh provincial production values from a BPS table', async () => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const latestYear = currentYear;
    const listResponse = {
      status: 'OK',
      'data-availability': 'available',
      data: [{}, [{ table_id: 42, title: 'Produksi Padi Menurut Provinsi' }]],
    };
    const table = `&lt;table&gt;&lt;tr&gt;&lt;td&gt;Wilayah Provinsi&lt;/td&gt;&lt;td&gt;${previousYear}&lt;/td&gt;&lt;td&gt;${latestYear}&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;Provinsi Jawa Barat&lt;/td&gt;&lt;td&gt;1.000&lt;/td&gt;&lt;td&gt;1.250&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;`;
    const detailResponse = {
      status: 'OK',
      'data-availability': 'available',
      data: { title: 'Produksi Padi Menurut Provinsi', table },
    };
    const dynamicUnavailable = {
      status: 'OK',
      'data-availability': 'not-available',
      data: [{}, []],
    };
    const httpService = {
      get: jest
        .fn()
        .mockReturnValueOnce(of({ data: dynamicUnavailable }))
        .mockReturnValueOnce(of({ data: listResponse }))
        .mockReturnValueOnce(of({ data: detailResponse })),
    };
    const configService = { get: () => 'test-key' };
    const service = new BpsService(httpService as any, configService as any);

    const result = await service.getRegionalAgriculturalBaseline('32', 'Padi');

    expect(result?.domain).toBe('3200');
    expect(result?.table_id).toBe(42);
    expect(result?.production_by_year).toEqual([
      { year: previousYear, value: 1000 },
      { year: latestYear, value: 1250 },
    ]);
    expect(httpService.get).toHaveBeenLastCalledWith(
      expect.stringContaining('/view/model/statictable/domain/3200/id/42/lang/ind/'),
      { timeout: 10000 },
    );
  });

  it('does not use metadata or a stale table as a production baseline', async () => {
    const oldYear = new Date().getFullYear() - 8;
    const listResponse = {
      status: 'OK',
      'data-availability': 'available',
      data: [{}, [{ table_id: 42, title: 'Produksi Padi Menurut Provinsi' }]],
    };
    const table = `&lt;table&gt;&lt;tr&gt;&lt;td&gt;Wilayah&lt;/td&gt;&lt;td&gt;${oldYear - 1}&lt;/td&gt;&lt;td&gt;${oldYear}&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;Provinsi Jawa Barat&lt;/td&gt;&lt;td&gt;1.000&lt;/td&gt;&lt;td&gt;1.250&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;`;
    const detailResponse = {
      status: 'OK',
      'data-availability': 'available',
      data: { title: 'Produksi Padi Menurut Provinsi', table },
    };
    const dynamicUnavailable = {
      status: 'OK',
      'data-availability': 'not-available',
      data: [{}, []],
    };
    const httpService = {
      get: jest
        .fn()
        .mockReturnValueOnce(of({ data: dynamicUnavailable }))
        .mockReturnValueOnce(of({ data: listResponse }))
        .mockReturnValueOnce(of({ data: detailResponse })),
    };
    const service = new BpsService(httpService as any, { get: () => 'test-key' } as any);

    await expect(service.getRegionalAgriculturalBaseline('32', 'Padi')).resolves.toBeNull();
  });

  it('prefers current dynamic production observations when available', async () => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const page = (items: any[]) => ({
      status: 'OK',
      'data-availability': 'available',
      data: [{ pages: 1 }, items],
    });
    const unavailablePage = {
      status: 'OK',
      'data-availability': 'not-available',
      data: [{ pages: 0 }, []],
    };
    const httpService = {
      get: jest
        .fn()
        .mockReturnValueOnce(
          of({
            data: page([
              { sub_id: 53, subcat: 'Pertanian dan Pertambangan' },
            ]),
          }),
        )
        .mockReturnValueOnce(
          of({
            data: page([
              { var_id: 52, title: 'Produksi Padi Menurut Kabupaten/Kota' },
            ]),
          }),
        )
        .mockReturnValueOnce(
          of({
            data: page([
              { th_id: 124, th: currentYear },
              { th_id: 123, th: previousYear },
            ]),
          }),
        )
        .mockReturnValueOnce(of({ data: unavailablePage }))
        .mockReturnValueOnce(
          of({
            data: {
              status: 'OK',
              'data-availability': 'available',
              vervar: [{ val: 3200, label: 'Provinsi Jawa Barat' }],
              datacontent: { '32005201240': 1250 },
            },
          }),
        )
        .mockReturnValueOnce(
          of({
            data: {
              status: 'OK',
              'data-availability': 'available',
              vervar: [{ val: 3200, label: 'Provinsi Jawa Barat' }],
              datacontent: { '32005201230': 1000 },
            },
          }),
        ),
    };
    const service = new BpsService(httpService as any, { get: () => 'test-key' } as any);

    const result = await service.getRegionalAgriculturalBaseline('32', 'Padi');

    expect(result?.table_id).toBe(52);
    expect(result?.production_by_year).toEqual([
      { year: previousYear, value: 1000 },
      { year: currentYear, value: 1250 },
    ]);
  });
});