importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDBKHpNUUOUvtNngU7MUjBmv7IRkxk2xZ8',
  authDomain: 'tani-siaga.firebaseapp.com',
  projectId: 'tani-siaga',
  storageBucket: 'tani-siaga.firebasestorage.app',
  messagingSenderId: '744928358215',
  appId: '1:744928358215:web:1eef1430afa5ab46a12662'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Tani Siaga';
  const options = {
    body: payload.notification?.body || 'Ada pembaruan baru untuk Anda.',
    data: payload.data || {}
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.targetUrl;
  let destination = new URL('/dashboard', self.location.origin).href;
  if (typeof targetUrl === 'string') {
    try {
      const candidate = new URL(targetUrl, self.location.origin);
      if (candidate.origin === self.location.origin) destination = candidate.href;
    } catch {}
  }
  event.waitUntil(clients.openWindow(destination));
});
