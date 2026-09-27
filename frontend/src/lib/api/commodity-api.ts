import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';
import { getAllPages, paginationQuery, type PaginatedResponse } from './pagination';

export interface Commodity {
  id: number;
  name: string;
  variety?: string | null;
  avg_harvest_days: number;
  max_humidity_percentage: number;
  max_temp_celsius: number;
  min_temp_celsius: number;
}

export interface CommodityPayload {
  name: string;
  variety?: string;
  avg_harvest_days: number;
  max_humidity_percentage: number;
  max_temp_celsius: number;
  min_temp_celsius: number;
}

async function requestCommodity<T>(url: string, method = 'GET', payload?: CommodityPayload | Partial<CommodityPayload>): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal memproses data komoditas.');
  }

  return data;
}

export async function getCommodities(): Promise<Commodity[]> {
  return getAllPages((page, limit) => getCommoditiesPage(page, limit));
}

export function getCommoditiesPage(page = 1, limit = 8, search = ''): Promise<PaginatedResponse<Commodity>> {
  return requestCommodity<PaginatedResponse<Commodity>>(`/commodities${paginationQuery(page, limit, search)}`);
}

export function getCommodityById(id: string | number): Promise<Commodity> {
  return requestCommodity<Commodity>(`/commodities/${id}`);
}

export function createCommodity(payload: CommodityPayload): Promise<Commodity> {
  return requestCommodity<Commodity>('/commodities', 'POST', payload);
}

export function updateCommodity(id: string | number, payload: Partial<CommodityPayload>): Promise<Commodity> {
  return requestCommodity<Commodity>(`/commodities/${id}`, 'PATCH', payload);
}

export function deleteCommodity(id: string | number): Promise<{ message?: string }> {
  return requestCommodity<{ message?: string }>(`/commodities/${id}`, 'DELETE');
}
