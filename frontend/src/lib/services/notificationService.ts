import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { authenticatedFetch } from '$lib/api/authenticated-fetch';
import { API_BASE_URL } from '$lib/api/api-url';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
let registeredToken: string | null = null;
let foregroundListenerReady = false;

function hasFirebaseConfig() {
	return Object.values(firebaseConfig).every(Boolean) && Boolean(vapidKey);
}

function getFirebaseApp(): FirebaseApp {
	return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

async function getMessagingClient(): Promise<Messaging | null> {
	if (!hasFirebaseConfig() || !(await isSupported())) return null;
	return getMessaging(getFirebaseApp());
}

async function registerTokenWithBackend(token: string) {
	const response = await authenticatedFetch(`${API_BASE_URL}/notification/device-token`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ fcmToken: token, deviceType: 'web' })
	});

	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
		throw new Error(message || 'Token tidak berhasil didaftarkan ke server.');
	}
}

async function removeTokenFromBackend(token: string) {
	const response = await authenticatedFetch(`${API_BASE_URL}/notification/device-token`, {
		method: 'DELETE',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ fcmToken: token })
	});

	if (!response.ok) throw new Error('Token tidak berhasil dinonaktifkan di server.');
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
	if (typeof window === 'undefined' || !window.isSecureContext || !('Notification' in window)) return 'unsupported';
	return Notification.permission;
}

export async function syncPushToken() {
	if (typeof window === 'undefined' || getNotificationPermission() !== 'granted') return false;

	const messaging = await getMessagingClient();
	if (!messaging) return false;

	const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
	const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
	if (!token) throw new Error('FCM tidak menghasilkan registration token.');

	if (registeredToken !== token) {
		await registerTokenWithBackend(token);
		registeredToken = token;
	}

	if (!foregroundListenerReady) {
			onMessage(messaging, (payload) => {
			const title = payload.notification?.title || 'Tani Siaga';
			const body = payload.notification?.body || 'Ada pembaruan baru untuk Anda.';
			if (Notification.permission === 'granted') new Notification(title, { body, icon: '/tani-siaga-logo.svg' });
		});
		foregroundListenerReady = true;
	}

	return true;
}

export async function enablePushNotifications() {
	if (getNotificationPermission() === 'unsupported') {
		throw new Error('Browser ini belum mendukung web push notification.');
	}

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return false;
	return syncPushToken();
}

export async function disablePushNotifications() {
	if (typeof window === 'undefined') return false;

	const messaging = await getMessagingClient();
	if (!messaging) return false;

	const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
	const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
	if (token) await removeTokenFromBackend(token);
	await deleteToken(messaging);
	registeredToken = null;
	return true;
}
