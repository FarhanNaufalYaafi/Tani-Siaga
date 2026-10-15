import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export interface AdminShopApproval {
  id: number;
  name: string;
  description: string;
  location: string;
  phone_number: string;
  profile_image_url?: string | null;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  warning_reason?: string | null;
  warning_at?: string | null;
  warning_evidence_urls?: string[];
  ban_reason?: string | null;
  ban_evidence_urls?: string[];
  banned_until?: string | null;
  created_at: string;
  user?: {
    id: number;
    email: string;
    role?: string;
  };
}

export interface AdminProductApproval {
  id: number;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  admin_action?: 'disabled' | 'deleted' | null;
  admin_action_reason?: string | null;
  admin_action_at?: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  description: string;
  image_url: string[];
  is_pre_order: boolean;
  farmland_id?: number | null;
  estimated_harvest_date?: string | null;
  po_quota_kg: number;
  po_booked_kg: number;
  shop?: {
    id: number;
    name: string;
    user?: {
      id: number;
      email: string;
    };
  };
  farmland?: {
    id: number;
    commodity?: { id: number; name: string } | null;
  };
}

export interface AdminShopDashboard {
  shop: AdminShopApproval;
  products: AdminProductApproval[];
  stats: {
    total_products: number;
    active_products: number;
    approved_products: number;
    pending_products: number;
    rejected_products: number;
  };
}

async function adminRequest<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Permintaan admin gagal.');
  }

  return data;
}

export function getPendingShopApprovals(page = 1, limit = 8, search = ''): Promise<{ message: string; data: AdminShopApproval[]; meta: { page: number; limit: number; total: number; total_pages: number } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  return adminRequest(`/shop/admin/pending?${params.toString()}`);
}

export function getAdminShops(page = 1, limit = 8, search = ''): Promise<{ message: string; data: AdminShopApproval[]; meta: { page: number; limit: number; total: number; total_pages: number } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  return adminRequest(`/shop/admin?${params.toString()}`);
}

export function getAdminShopDashboard(id: number): Promise<{ message: string; data: AdminShopDashboard }> {
  return adminRequest(`/shop/admin/${id}/dashboard`);
}

export function approveShop(id: number): Promise<{ message: string; shop: AdminShopApproval }> {
  return adminRequest(`/shop/admin/${id}/approve`, 'PATCH');
}

export function rejectShop(id: number, reason?: string): Promise<{ message: string; shop: AdminShopApproval }> {
  return adminRequest(`/shop/admin/${id}/reject`, 'PATCH', { reason });
}

export function warnShop(id: number, reason: string, evidenceUrls: string[] = []): Promise<{ message: string; shop: AdminShopApproval }> {
  return adminRequest(`/shop/admin/${id}/warn`, 'PATCH', { reason, evidence_urls: evidenceUrls });
}

export function sanctionShop(id: number, reason: string, durationDays: number, evidenceUrls: string[] = []): Promise<{ message: string; shop: AdminShopApproval }> {
  return adminRequest(`/shop/admin/${id}/ban`, 'PATCH', { reason, duration_days: durationDays, evidence_urls: evidenceUrls });
}

export function liftShopSanction(id: number): Promise<{ message: string; shop: AdminShopApproval }> {
  return adminRequest(`/shop/admin/${id}/lift-sanction`, 'PATCH');
}

export function reduceShopSanction(id: number, days: number): Promise<{ message: string; lifted: boolean }> {
  return adminRequest(`/shop/admin/${id}/reduce-sanction`, 'PATCH', { days });
}

export function deleteShopByAdmin(id: number): Promise<{ message: string; shop_id: number }> {
  return adminRequest(`/shop/admin/${id}`, 'DELETE');
}

export function getPendingProductApprovals(page = 1, limit = 8, search = ''): Promise<{ message: string; data: AdminProductApproval[]; meta: { page: number; limit: number; total: number; total_pages: number } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  return adminRequest(`/products/admin/pending?${params.toString()}`);
}

export function approveProduct(id: number): Promise<{ message: string; product: AdminProductApproval }> {
  return adminRequest(`/products/admin/${id}/approve`, 'PATCH');
}

export function rejectProduct(id: number, reason?: string): Promise<{ message: string; product: AdminProductApproval }> {
  return adminRequest(`/products/admin/${id}/reject`, 'PATCH', { reason });
}

export function deactivateProductByAdmin(id: number, reason: string): Promise<{ message: string; product: AdminProductApproval }> {
  return adminRequest(`/products/admin/${id}/deactivate`, 'PATCH', { reason });
}

export function reactivateProductByAdmin(id: number): Promise<{ message: string; product: AdminProductApproval }> {
  return adminRequest(`/products/admin/${id}/reactivate`, 'PATCH');
}

export function deleteProductByAdmin(id: number, reason: string): Promise<{ message: string; deleted_id: number; reason: string }> {
  return adminRequest(`/products/admin/${id}`, 'DELETE', { reason });
}
