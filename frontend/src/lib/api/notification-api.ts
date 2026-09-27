import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export type NotificationSeverity = 'safe' | 'warning' | 'danger';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  severity: NotificationSeverity;
  targetUrl?: string | null;
  metadata?: Record<string, string | number> | null;
  isRead: boolean;
  createdAt: string;
}

async function request<T>(url: string, method = 'GET'): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${url}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Gagal memuat notifikasi.');
  return data;
}

export function getNotifications(): Promise<{ data: AppNotification[]; unreadCount: number }> {
  return request('/notification');
}

export function getNotification(id: string | number): Promise<AppNotification> {
  return request(`/notification/${id}`);
}

export function markNotificationRead(id: string | number): Promise<AppNotification> {
  return request<AppNotification>(`/notification/${id}/read`, 'PATCH').then((notification) => {
    dispatchNotificationUpdate();
    return notification;
  });
}

export function markAllNotificationsRead(): Promise<{ updatedCount: number }> {
  return request<{ updatedCount: number }>('/notification/read-all', 'PATCH').then((result) => {
    dispatchNotificationUpdate();
    return result;
  });
}

export function deleteNotification(id: string | number): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/notification/${id}`, 'DELETE').then((result) => {
    dispatchNotificationUpdate();
    return result;
  });
}

export function deleteAllNotifications(): Promise<{ deletedCount: number }> {
  return request<{ deletedCount: number }>('/notification', 'DELETE').then((result) => {
    dispatchNotificationUpdate();
    return result;
  });
}

function dispatchNotificationUpdate() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications-updated'));
}
