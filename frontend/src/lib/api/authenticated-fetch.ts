import { API_BASE_URL } from './api-url';

let refreshInFlight: Promise<void> | null = null;

function refreshSessionOnce(): Promise<void> {
	if (!refreshInFlight) {
		refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
			method: 'POST',
			credentials: 'include',
		})
			.then(() => undefined)
			.catch(() => undefined)
			.finally(() => {
				refreshInFlight = null;
			});
	}

	return refreshInFlight;
}

function isAuthEntryPoint(url: string): boolean {
	return ['/auth/signin', '/auth/signup', '/auth/refresh', '/auth/google'].some((path) => url.includes(path));
}

export async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
	const options: RequestInit = { ...init, credentials: 'include' };
	const response = await fetch(url, options);

	if (response.status !== 401 || isAuthEntryPoint(url)) return response;

	await refreshSessionOnce();
	return fetch(url, options);
}