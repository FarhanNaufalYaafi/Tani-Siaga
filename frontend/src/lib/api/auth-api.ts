import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export interface SignupinDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  message?: string;
  id?: number | string;
  email?: string;
  role?: string;
  accessToken?: string;
}

export interface CurrentUserDto {
  id?: number | string;
  userId?: number | string;
  email: string;
  role?: string;
  farmer_group_id?: number | null;
  group_status?: string;
  pending_farmer_group_id?: number | null;
  provider?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateUserPayload {
  email?: string;
}

export interface PasswordResetPayload {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}

export interface ProfilePasswordPayload {
  currentPassword: string;
  code: string;
  password: string;
  confirmPassword: string;
}

async function publicAuthRequest<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Permintaan autentikasi gagal.');
  }
  return data;
}

async function authRequest<T>(url: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Permintaan akun gagal.');
  }
  return data;
}

/**
 * Panggilan API untuk Registrasi Akun Baru
 */
export async function signupApi(dto: SignupinDto): Promise<AuthResponseDto> {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  const data = await response.json();

  if (!response.ok) {
    // Menangkap pesan error dari NestJS (biasanya di data.message)
    const errorMessage = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || 'Gagal mendaftar akun. Silakan coba lagi.';
    throw new Error(errorMessage);
  }

  return data;
}

export async function signinApi(dto: SignupinDto): Promise<AuthResponseDto> {
  const response = await fetch(`${API_BASE_URL}/auth/signin`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || 'Email atau password salah.';
    throw new Error(errorMessage);
  }

  return data;
}

export async function getCurrentUser(): Promise<CurrentUserDto> {
  return authRequest<CurrentUserDto>('/auth/me');
}

export function updateCurrentUser(payload: UpdateUserPayload): Promise<{ message?: string }> {
  return authRequest<{ message?: string }>('/user/update', 'PATCH', payload);
}

export function signoutApi(): Promise<{ message?: string }> {
  return authRequest<{ message?: string }>('/auth/signout', 'POST');
}

export function verifySignupEmailApi(payload: { email: string; code: string }): Promise<AuthResponseDto> {
  return publicAuthRequest<AuthResponseDto>('/auth/verify-email', payload);
}

export function requestPasswordResetCode(email: string): Promise<{ message: string }> {
  return publicAuthRequest('/auth/forgot-password', { email });
}

export function verifyPasswordResetCode(email: string, code: string): Promise<{ message: string }> {
  return publicAuthRequest('/auth/verify-reset-code', { email, code });
}

export function resetPasswordApi(payload: PasswordResetPayload): Promise<{ message: string }> {
  return publicAuthRequest('/auth/reset-password', payload);
}

export function requestProfilePasswordCode(currentPassword: string): Promise<{ message: string }> {
  return authRequest('/auth/profile/password-code', 'POST', { currentPassword });
}

export function changeProfilePassword(payload: ProfilePasswordPayload): Promise<{ message: string }> {
  return authRequest('/auth/profile/password', 'PATCH', payload);
}