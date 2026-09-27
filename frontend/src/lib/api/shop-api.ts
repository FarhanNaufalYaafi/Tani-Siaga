import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export interface Shop {
  id: number;
  name: string;
  description: string;
  location: string;
  phone_number: string;
  created_at: string;
}

export interface PublicShopProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  description: string;
  image_url: string[];
  is_pre_order: boolean;
  po_quota_kg: number;
  po_booked_kg: number;
  estimated_harvest_date?: string | null;
  sold_quantity: number;
  completed_orders: number;
  booked_percentage: number | null;
}

export interface PublicShopResponse {
  shop: Shop;
  stats: {
    sold_quantity: number;
    completed_orders: number;
  };
  products: PublicShopProduct[];
}

export interface ShopResponse {
  message: string;
  has_shop: boolean;
  shop: Shop | null;
}

export interface CreateShopPayload {
  name: string;
  description: string;
  location: string;
  phone_number: string;
}

export interface MyProductsResponse {
  message: string;
  data: Array<{
    id: number;
    name: string;
    price: number;
    stock: number;
    description: string;
    image_url: string[];
    is_pre_order: boolean;
    farmland_id?: number | null;
    estimated_harvest_date?: string | null;
    po_quota_kg: number;
    po_booked_kg: number;
  }>;
}

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Permintaan toko gagal.',
    );
  }
  return data;
}

export function getMyShop(): Promise<ShopResponse> {
  return request<ShopResponse>('/shop/me');
}

export function createShop(payload: CreateShopPayload): Promise<Shop> {
  return request<Shop>('/shop', 'POST', payload);
}

export function getMyShopProducts(): Promise<MyProductsResponse> {
  return request<MyProductsResponse>('/shop/me/products');
}

export function getPublicShop(id: string | number): Promise<PublicShopResponse> {
  return request<PublicShopResponse>(`/shop/${id}`);
}
