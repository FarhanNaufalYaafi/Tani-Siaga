import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';
import { getAllPages, paginationQuery, type PaginatedResponse } from './pagination';

export interface FarmerMember {
  id: number;
  email: string;
  role: string;
  group_status?: string;
  farmer_group_id?: number | null;
  pending_farmer_group_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface FarmerGroup {
  id: number;
  name: string;
  poktan_id?: string | null;
  address?: string | null;
  group_leader_id?: number;
  members?: FarmerMember[];
  description?: string;
  location?: string;
  isPending?: boolean;
  applicationStatus?: 'pending' | 'approved' | 'rejected' | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateFarmerDto {
  name: string;
  poktan_id?: string;
  address?: string;
}

/**
 * Get All Kelompok Tani
 */
export async function getAllFarmerGroups(): Promise<FarmerGroup[]> {
  return getAllPages((page, limit) => getFarmerGroupPage(page, limit));
}

export async function getFarmerGroupPage(page = 1, limit = 8, search = ''): Promise<PaginatedResponse<FarmerGroup>> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group${paginationQuery(page, limit, search)}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sesi kamu telah berakhir. Silakan Sign In.');
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal mengambil data.');
  }
  return data;
}

/**
 * Get One Kelompok Tani By ID
 */
export async function getFarmerGroupById(id: string | number): Promise<FarmerGroup> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group/${id}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sesi kamu telah berakhir. Silakan Sign In.');
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal mengambil detail.');
  }
  return data;
}

/**
 * Create Kelompok Tani Baru
 */
export async function createFarmerGroup(payload: CreateFarmerDto): Promise<{ messsage: string; data: FarmerGroup }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal membuat kelompok tani.');
  }
  return data;
}

/**
 * Apply / Ajukan Bergabung
 */
export async function applyToFarmerGroup(id: string | number): Promise<{ message?: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group/${id}/apply`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal mengajukan bergabung.');
  }
  return data;
}

/**
 * Keluarkan Anggota (Khusus Leader)
 */
export async function removeGroupMember(memberId: number): Promise<{ message?: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group/members/${memberId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal mengeluarkan anggota.');
  }
  return data;
}

/**
 * Tambahkan Anggota berdasarkan User ID (Khusus Leader)
 */
export async function addGroupMember(userId: number): Promise<{ message?: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group/add-members`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal menambahkan anggota.');
  }
  return data;
}

/**
 * Ambil Daftar Anggota Pending (Khusus Leader)
 */
export async function getPendingMembers(): Promise<FarmerMember[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group/pending`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal mengambil daftar pending.');
  }
  return data;
}

/**
 * Terima Calon Anggota (Approve)
 */
export async function approveMember(memberId: number): Promise<{ message?: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group/approve/${memberId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal menyetujui anggota.');
  }
  return data;
}

/**
 * Tolak Calon Anggota (Reject)
 */
export async function rejectMember(memberId: number): Promise<{ message?: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group/reject/${memberId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal menolak anggota.');
  }
  return data;
}

// Keluar dari kelompok tani
export async function leaveFarmerGroup(): Promise<{ message?: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/farmer-group/leave`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Gagal keluar dari kelompok tani.');
  }

  return await response.json();
}