import type { CurrentUserDto } from '$lib/api/auth-api';

function storageKey(user: CurrentUserDto | null) {
  const accountId = user?.id ?? user?.userId ?? user?.email ?? 'guest';
  return `tani-siaga-theme:${accountId}`;
}

export function applyAccountTheme(user: CurrentUserDto | null): boolean {
  if (typeof window === 'undefined') return false;

  let isDark = false;
  try {
    isDark = window.localStorage.getItem(storageKey(user)) === 'dark';
  } catch {
    isDark = false;
  }

  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  return isDark;
}

export function applyStoredAccountTheme(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const cachedUser = window.localStorage.getItem('user');
    const user = cachedUser ? (JSON.parse(cachedUser) as CurrentUserDto) : null;
    return applyAccountTheme(user);
  } catch {
    return applyAccountTheme(null);
  }
}

export function setAccountTheme(user: CurrentUserDto | null, isDark: boolean) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey(user), isDark ? 'dark' : 'light');
  } catch {
    // Keep the current page theme even when browser storage is unavailable.
  }

  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}