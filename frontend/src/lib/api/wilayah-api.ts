import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export interface WilayahItem {
  code: string;
  name: string;
}

export function getProvinceCodeFromRegionCode(code?: string | null): string {
  return String(code || '').replace(/\D/g, '').slice(0, 2);
}

async function getWilayah(path: string): Promise<WilayahItem[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/wilayah/${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Gagal mengambil data wilayah.');
  }

  return data;
}

export const getProvinces = () => getWilayah('provinces');
export const getRegencies = (provinceCode: string) => getWilayah(`regencies/${provinceCode}`);
export const getDistricts = (regencyCode: string) => getWilayah(`districts/${regencyCode}`);
export const getVillages = (districtCode: string) => getWilayah(`villages/${districtCode}`);
