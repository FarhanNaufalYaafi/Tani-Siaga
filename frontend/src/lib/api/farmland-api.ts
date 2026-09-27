
import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';
import { getAllPages, paginationQuery, type PaginatedResponse } from './pagination';

export interface FarmlandUser {
  id: number;
  email: string;
}

export interface FarmlandCommodity {
  id: number;
  name: string;
}

export interface FarmlandGroup {
  id: number;
  name: string;
}

export interface Farmland {
  id: number;
  name: string;
  status?: 'active' | 'harvested';
  harvested_at?: string | null;
  area_size: number | string;
  farmer_group_id?: number | null;
  user_id?: number;
  address_detail?: string | null;
  adm4_code?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  plant_date?: string | null;
  plant_method?: string;
  expected_yield_user_kg?: number | string | null;
  custom_avg_harvest_days?: number | string | null;
  custom_max_humidity_percentage?: number | string | null;
  custom_max_temp_celsius?: number | string | null;
  custom_min_temp_celsius?: number | string | null;
  ai_estimated_yield_kg?: number | string | null;
  created_at?: string;
  updated_at?: string;
  user?: FarmlandUser | null;
  commodity?: FarmlandCommodity | null;
  farmerGroup?: FarmlandGroup | null;
}

export interface FarmlandPayload {
  name: string;
  area_size: number;
  adm4_code: string;
  address_detail?: string;
  latitude?: number;
  longitude?: number;
  plant_date?: string;
  plant_method: string;
  commodity_id?: number;
  custom_avg_harvest_days?: number;
  custom_max_humidity_percentage?: number;
  custom_max_temp_celsius?: number;
  custom_min_temp_celsius?: number;
  expected_yield_user_kg?: number;
}

async function requestFarmlands<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal mengambil data lahan tani.');
  }

  return data;
}

export async function getMyFarmlands(): Promise<Farmland[]> {
  return getAllPages((page, limit) => getMyFarmlandsPage(page, limit));
}

export function getMyFarmlandsPage(page = 1, limit = 8, search = ''): Promise<PaginatedResponse<Farmland>> {
  return requestFarmlands<PaginatedResponse<Farmland>>(`/farmlands/my${paginationQuery(page, limit, search)}`);
}

// Mengambil daftar lahan berdasarkan ID Kelompok Tani
export async function getGroupFarmlands(groupId: string | number): Promise<Farmland[]> {
  return getAllPages((page, limit) => getGroupFarmlandsPage(groupId, page, limit));
}

export function getGroupFarmlandsPage(groupId: string | number, page = 1, limit = 8, search = ''): Promise<PaginatedResponse<Farmland>> {
  return requestFarmlands<PaginatedResponse<Farmland>>(`/farmlands/group/${groupId}${paginationQuery(page, limit, search)}`);
}

// Mengambil detail satu lahan tani
export async function getFarmlandById(id: string | number): Promise<Farmland> {
  return requestFarmlands<Farmland>(`/farmlands/${id}`);
}

async function mutateFarmland(url: string, method: 'POST' | 'PATCH' | 'DELETE', payload?: FarmlandPayload | Partial<FarmlandPayload>) {
  const response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal menyimpan data lahan tani.');
  }

  return data;
}

export async function createFarmland(payload: FarmlandPayload): Promise<Farmland> {
  return mutateFarmland('/farmlands', 'POST', payload);
}

export async function updateFarmland(id: string | number, payload: Partial<FarmlandPayload>): Promise<Farmland> {
  return mutateFarmland(`/farmlands/${id}`, 'PATCH', payload);
}

export async function replantFarmland(id: string | number, payload: Partial<FarmlandPayload>): Promise<Farmland> {
  return mutateFarmland(`/farmlands/${id}/replant`, 'POST', payload);
}

export async function deleteFarmland(id: string | number): Promise<{ message?: string }> {
  return mutateFarmland(`/farmlands/${id}`, 'DELETE');
}

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

export async function getFarmlandWeather(id: string | number): Promise<{ forecasts: WeatherForecast[]; adm4_code: string }> {
  return requestFarmlands<{ forecasts: WeatherForecast[]; adm4_code: string }>(`/farmlands/${id}/weather`);
}