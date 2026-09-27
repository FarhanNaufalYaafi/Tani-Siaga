import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export interface ProductShop { id: number; name: string; location?: string; }
export interface ProductFarmland {
  id: number;
  name: string;
  status?: 'active' | 'harvested';
  farmer_group_id?: number | null;
  harvested_at?: string | null;
  commodity?: { id: number; name: string } | null;
}
export interface ProductWeatherForecast {
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
export interface Product {
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
  shop?: ProductShop | null;
  farmland?: ProductFarmland | null;
  sold_quantity?: number;
  completed_orders?: number;
  booked_percentage?: number | null;
  weather_forecasts?: ProductWeatherForecast[];
}

export interface UpdateProductPayload {
  name?: string;
  price?: number;
  stock?: number;
  description?: string;
  image_url?: string[];
  is_pre_order?: boolean;
  farmland_id?: number | null;
  po_quota_kg?: number;
}

export interface CreateProductPayload {
  name: string;
  price: number;
  stock?: number;
  description: string;
  image_url: string[];
  is_pre_order?: boolean;
  farmland_id?: number;
  po_quota_kg?: number;
}

export interface ProductCatalog {
  data: Product[];
  meta: { page: number; limit: number; total: number; total_pages: number };
}

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Server terlalu lama merespons. Coba lagi.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Permintaan produk gagal.');
  return data;
}

export function getProducts(category: 'all' | 'pre_order' | 'ready_stock' = 'all', page = 1, limit = 8, search = ''): Promise<ProductCatalog> {
  const query = new URLSearchParams({ category, page: String(page), limit: String(limit) });
  if (search.trim()) query.set('search', search.trim());
  return request<ProductCatalog>(`/products?${query.toString()}`);
}

export function getProductById(id: string | number): Promise<Product> {
  return request<Product>(`/products/${id}`);
}

export function createProduct(payload: CreateProductPayload): Promise<Product> {
  return request<Product>('/products', 'POST', payload);
}

export function updateProduct(id: string | number, payload: UpdateProductPayload): Promise<Product> {
  return request<Product>(`/products/${id}`, 'PATCH', payload);
}

export function completeHarvest(id: string | number, actual_harvest_yield_kg: number): Promise<Product> {
  return request(`/products/${id}/complete-harvest`, 'POST', { actual_harvest_yield_kg });
}

export function completeFarmlandHarvest(id: string | number, actual_harvest_yield_kg: number): Promise<{ message: string; farmland: unknown; products: Product[] }> {
  return request(`/products/farmlands/${id}/complete-harvest`, 'POST', { actual_harvest_yield_kg });
}

export function deleteProduct(id: string | number): Promise<{ message?: string; deleted_id?: number }> {
  return request(`/products/${id}`, 'DELETE');
}

export interface CartItem { id: number; quantity: number; total_price: number; product: Product; }
export interface Cart { id: number; cartItems: CartItem[]; }

export function addToCart(productId: string | number, quantity: number): Promise<{ success: boolean; message: string; data: CartItem }> {
  return request(`/cart-items/${productId}`, 'POST', { quantity });
}

export function updateCartItemQuantity(id: string | number, quantity: number): Promise<{ success: boolean; data: CartItem }> {
  return request(`/cart-items/${id}`, 'PATCH', { quantity });
}

export function getCart(): Promise<Cart> { return request<Cart>('/cart'); }
export function removeCartItem(id: string | number): Promise<{ message?: string }> { return request(`/cart-items/${id}`, 'DELETE'); }
