<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import Modal from '$lib/components/Modal.svelte';
	import '../app.css';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { showAlert } from '$lib/services/dialog';
	import { getNotifications } from '$lib/api/notification-api';
	import { disablePushNotifications, enablePushNotifications, getNotificationPermission, syncPushToken } from '$lib/services/notificationService';

	let { children } = $props();
	let isAuthRoute = $derived(['/signin', '/signup', '/forgot-password'].includes($page.url.pathname));

	let currentUser = $state<CurrentUserDto | null>(null);
	let authRedirectStarted = false;
	type NotificationState = NotificationPermission | 'unsupported' | 'off' | 'loading' | 'error';
	let notificationState = $state<NotificationState>('default');
	let notificationPromptOpen = $state(false);
	let doNotRemind = $state(false);
	let promptedUserKey = '';
	let unreadNotificationCount = $state(0);
	let navLinks = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/ai-recommendations', label: 'Rekomendasi AI' },
		{ href: '/market-analysis', label: 'Analisis Pasar' },
		{ href: '/e-commerce', label: 'E-Commerce' },
		{ href: '/kelompok-tani', label: 'Kelompok Tani' },
		{ href: '/lahan-tani', label: 'Lahan Tani' },
		{ href: '/komoditas', label: 'Komoditas' },
		{ href: '/toko', label: 'Toko' },
		{ href: '/tentang-kami', label: 'Tentang Kami' },
	];

	let headerHidden = $state(false);
	let headerFading = $state(false);
	let mobileNavOpen = $state(false);
	let lastScrollY = 0;
	let ticking = false;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function getUserKey(user: CurrentUserDto) {
		return String(user.id ?? user.userId ?? user.email);
	}

	function getDisabledKey(userKey: string) {
		return `tani-siaga-notifications-disabled:${userKey}`;
	}

	function getSnoozeKey(userKey: string) {
		return `tani-siaga-notification-reminder:${userKey}`;
	}

	function maybeShowNotificationPrompt(user: CurrentUserDto, state: NotificationState) {
		if (!browser || state === 'granted' || state === 'unsupported') return;
		const userKey = getUserKey(user);
		if (promptedUserKey === userKey) return;
		promptedUserKey = userKey;
		const snoozedUntil = Number(localStorage.getItem(getSnoozeKey(userKey)) || 0);
		if (snoozedUntil <= Date.now()) notificationPromptOpen = true;
	}

	async function loadCurrentUser() {
		try {
			currentUser = await getCurrentUser();
			if (isAuthRoute) {
				if (!authRedirectStarted) {
					authRedirectStarted = true;
					await showAlert('Anda masih login. Sign out terlebih dahulu sebelum masuk atau mendaftar dengan akun lain.', {
						title: 'Sesi masih aktif',
						tone: 'warning',
					});
					await goto('/dashboard', { replaceState: true });
				}
				return;
			}
			authRedirectStarted = false;
			const userKey = getUserKey(currentUser);
			const isDisabled = browser && localStorage.getItem(getDisabledKey(userKey)) === 'true';
			notificationState = isDisabled ? 'off' : getNotificationPermission();
			if (notificationState === 'granted') void syncPushToken().catch(() => { notificationState = 'error'; });
			else maybeShowNotificationPrompt(currentUser, notificationState);
			void getNotifications().then((result) => { unreadNotificationCount = result.unreadCount; }).catch(() => { unreadNotificationCount = 0; });
		} catch {
			authRedirectStarted = false;
			currentUser = null;
			unreadNotificationCount = 0;
			notificationPromptOpen = false;
			promptedUserKey = '';
		}
	}

	async function toggleNotifications() {
		if (browser && !window.isSecureContext) {
			notificationState = 'unsupported';
			await showAlert('Notifikasi web memerlukan koneksi HTTPS. Browser tidak mendukung izin push notification melalui HTTP biasa.', {
				title: 'Notifikasi memerlukan HTTPS',
				tone: 'warning',
			});
			return;
		}

		const wasEnabled = notificationState === 'granted';
		notificationState = 'loading';
		try {
			if (wasEnabled) {
				const disabled = await disablePushNotifications();
				if (!disabled) throw new Error('Browser tidak dapat menonaktifkan web push notification.');
				if (currentUser && browser) localStorage.setItem(getDisabledKey(getUserKey(currentUser)), 'true');
				notificationState = 'off';
				return;
			}

			if (currentUser && browser) localStorage.removeItem(getDisabledKey(getUserKey(currentUser)));
			const enabled = await enablePushNotifications();
			if (!enabled) {
				const permission = getNotificationPermission();
				notificationState = permission;
				const message = permission === 'denied'
					? 'Izin notifikasi ditolak. Ubah izin situs Tani Siaga di pengaturan browser, lalu coba lagi.'
					: permission === 'granted'
						? 'Browser tidak berhasil menyiapkan layanan push. Coba lagi dari browser yang mendukung notifikasi.'
						: 'Izin notifikasi belum diberikan. Coba aktifkan kembali dan pilih Izinkan.';
				await showAlert(message, { title: 'Notifikasi belum aktif', tone: 'warning' });
				return;
			}

			notificationState = 'granted';
			notificationPromptOpen = false;
		} catch (error) {
			notificationState = getNotificationPermission() === 'granted' ? 'granted' : 'error';
			await showAlert(error instanceof Error ? error.message : 'Terjadi kesalahan saat menyiapkan notifikasi.', {
				title: 'Gagal mengatur notifikasi',
				tone: 'error',
			});
		}
	}

	function closeNotificationPrompt() {
		if (doNotRemind && currentUser && browser) {
			localStorage.setItem(getSnoozeKey(getUserKey(currentUser)), String(Date.now() + 7 * 24 * 60 * 60 * 1000));
		}
		notificationPromptOpen = false;
		doNotRemind = false;
	}

	function refreshUnreadNotificationCount() {
		void getNotifications().then((result) => { unreadNotificationCount = result.unreadCount; }).catch(() => {});
	}

	$effect(() => {
		const unsubscribe = page.subscribe(async () => {
			void tick();
			if (browser) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
			await loadCurrentUser();
		});
		return unsubscribe;
	});

	function onScroll() {
		if (!ticking) {
			window.requestAnimationFrame(() => {
				const currentY = window.scrollY;
				const delta = currentY - lastScrollY;

				if (Math.abs(delta) < 6) {
					ticking = false;
					return;
				}

				if (currentY <= 20) {
					headerHidden = false;
					headerFading = false;
					if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
				} else if (delta > 0) {
					if (!headerHidden) {
						headerHidden = true;
						headerFading = true;
					}
					if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
				} else {
					headerHidden = false;
					headerFading = false;
					if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
				}

				lastScrollY = currentY;
				ticking = false;
			});
			ticking = true;
		}
	}

	onMount(() => {
		void loadCurrentUser();
		lastScrollY = window.scrollY;
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('notifications-updated', refreshUnreadNotificationCount);
	});

	onDestroy(() => {
		if (!browser) return;
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('notifications-updated', refreshUnreadNotificationCount);
		if (hideTimer) clearTimeout(hideTimer);
	});

	function isActive(path: string) {
		const p = $page.url.pathname;
		if (path === '/dashboard') return p === '/dashboard' || p === '/';
		if (path === '/toko') return p === '/toko' || p.startsWith('/toko/');
		return p === path || p.startsWith(path + '/');
	}

	async function goToSignin() { await goto('/signin'); }
	async function goToSignup() { await goto('/signup'); }

	function horizontalWheelScroll(node: HTMLElement) {
		function onWheel(event: WheelEvent) {
			if (window.matchMedia('(max-width: 1180px)').matches) return;
			event.preventDefault();

			const target = event.target;
			if (!(target instanceof Element)) return;
			const nav = target.closest<HTMLElement>('.main-nav');
			if (!nav || !node.contains(nav)) return;

			const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
			nav.scrollLeft = Math.max(0, Math.min(nav.scrollWidth - nav.clientWidth, nav.scrollLeft + delta));
		}

		node.addEventListener('wheel', onWheel, { passive: false });
		return { destroy: () => node.removeEventListener('wheel', onWheel) };
	}

	let initials = $derived(currentUser?.email?.slice(0, 1).toUpperCase() || 'G');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="app-shell">
	{#if !isAuthRoute}
	<header class="app-header" class:hidden={headerHidden} class:fading={headerFading} use:horizontalWheelScroll>
		<div class="header-inner">
			<a class="brand" href="/dashboard" aria-label="Tani Siaga Dashboard">
				<span class="brand-mark">✦</span>
				<span class="brand-text">Tani Siaga</span>
			</a>
			<button class="nav-toggle" type="button" aria-label={mobileNavOpen ? 'Tutup navigasi' : 'Buka navigasi'} aria-expanded={mobileNavOpen} aria-controls="primary-navigation" onclick={() => (mobileNavOpen = !mobileNavOpen)}>
				<span aria-hidden="true">{mobileNavOpen ? '×' : '☰'}</span>
			</button>
			<nav id="primary-navigation" class="main-nav" class:open={mobileNavOpen} aria-label="Navigasi utama">
				{#each navLinks as link}
					<a href={link.href} class:active={isActive(link.href)} onclick={() => (mobileNavOpen = false)}>{link.label}</a>
				{/each}
			</nav>
			<div class="header-actions">
				{#if currentUser}
					<a class="notification-link" href="/notifikasi" aria-label={`Notifikasi${unreadNotificationCount ? `, ${unreadNotificationCount} belum dibaca` : ''}`}>
						<span class="bell" aria-hidden="true">🔔</span>
						{#if unreadNotificationCount > 0}<span class="notification-badge">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>{/if}
					</a>
					<button
						class="notification-toggle"
						class:on={notificationState === 'granted'}
						role="switch"
						aria-checked={notificationState === 'granted'}
						aria-label={notificationState === 'granted' ? 'Matikan notifikasi' : 'Nyalakan notifikasi'}
						onclick={toggleNotifications}
						disabled={notificationState === 'loading'}
					>
						<span class="toggle-label">Notifikasi</span>
						<span class="toggle-track"><span class="toggle-thumb"></span></span>
					</button>
					<a class="profile-link" href="/profil">
						<span class="avatar">{initials}</span>
						<span>Profil</span>
					</a>
				{:else}
					<div class="auth-actions">
						<button class="link-btn" onclick={goToSignin}>Sign in</button>
						<button class="signup-btn" onclick={goToSignup}>Sign up</button>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<div class="header-spacer"></div>
	{/if}

	<main class="app-main">
		{@render children()}
	</main>
	<Modal />

	{#if notificationPromptOpen}
		<div class="notification-backdrop" role="presentation">
			<dialog open class="notification-modal" aria-labelledby="notification-title">
				<button class="modal-close" aria-label="Tutup" onclick={closeNotificationPrompt}>×</button>
				<span class="modal-kicker">Pemberitahuan penting</span>
				<h2 id="notification-title">Jangan lewatkan kabar dari lahanmu.</h2>
				<p>Aktifkan notifikasi untuk menerima perubahan prediksi cuaca, analisis pasar, rekomendasi lahan, dan pembaruan pesanan toko.</p>
				<div class="modal-actions">
					<button class="modal-primary" onclick={toggleNotifications}>Aktifkan notifikasi</button>
					<button class="modal-secondary" onclick={closeNotificationPrompt}>Nanti saja</button>
				</div>
				<label class="snooze-option">
					<input type="checkbox" bind:checked={doNotRemind} />
					<span>Jangan ingatkan saya selama 7 hari</span>
				</label>
			</dialog>
		</div>
	{/if}

	{#if !isAuthRoute}
	<footer class="app-footer">
		<div class="footer-inner">
			<div class="footer-brand-col">
				<a class="footer-brand" href="/dashboard">Tani Siaga</a>
				<p>Teknologi yang tumbuh bersama petani.</p>
			</div>
			<div class="footer-links">
				<a href="/tentang-kami">Tentang Kami</a>
				<a href="/dashboard">Dashboard</a>
				<a href="/komoditas">Komoditas</a>
				<a href="/market-analysis">Analisis Pasar</a>
				<a href="/ai-recommendations">Rekomendasi AI</a>
				<a href="/kelompok-tani">Kelompok Tani</a>
				<a href="/lahan-tani">Lahan Tani</a>
				<a href="/e-commerce">E-Commerce</a>
				<a href="/toko">Toko</a>
			</div>
			<span class="copyright">© {new Date().getFullYear()} Tani Siaga</span>
		</div>
	</footer>
	{/if}
</div>

<style>
	.app-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #f5f7f0;
		color: #183126;
	}

	.app-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 60;
		background: #183126;
		color: #fff;
		box-shadow: 0 5px 20px #12271d30;
		transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.35s ease,
			box-shadow 0.3s ease;
		opacity: 1;
		transform: translateY(0);
		will-change: transform, opacity;
	}
	.app-header.hidden {
		transform: translateY(-102%);
		opacity: 0;
		pointer-events: none;
		box-shadow: none;
	}

	.header-inner {
		display: flex;
		align-items: center;
		gap: 36px;
		max-width: 1280px;
		min-height: 76px;
		margin: auto;
		padding: 0 38px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 0 0 auto;
		color: #fff;
		font: 700 22px 'DM Sans', sans-serif;
		text-decoration: none;
		white-space: nowrap;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 33px;
		height: 33px;
		border-radius: 50%;
		background: #6eaa78;
		color: #f8d68b;
		font-size: 18px;
	}
	.brand-text { letter-spacing: 0.01em; }
	.nav-toggle { display: none; width: 40px; height: 40px; place-items: center; flex: 0 0 auto; border: 1px solid #526b5a; border-radius: 7px; background: transparent; color: #fff; font-size: 21px; line-height: 1; cursor: pointer; }

	.main-nav {
		display: flex;
		min-width: 0;
		justify-content: flex-start;
		gap: 24px;
		flex: 1 1 0;
		flex-wrap: nowrap;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.main-nav::-webkit-scrollbar { display: none; }
	.main-nav a { flex: 0 0 auto; }
	.main-nav a {
		color: #c3d3c0;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		transition: color 0.2s;
		padding: 6px 2px;
		border-bottom: 2px solid transparent;
	}
	.main-nav a:hover { color: #f7d88f; }
	.main-nav a.active {
		color: #fff;
		border-bottom-color: #f7d88f;
	}

	.header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex: 0 0 auto; }
	.notification-link { position: relative; display: grid; place-items: center; width: 30px; height: 34px; color: #fff; text-decoration: none; }
	.bell { font-size: 17px; line-height: 1; filter: grayscale(1) brightness(2); }
	.notification-badge { position: absolute; top: 0; right: -3px; min-width: 16px; height: 16px; border-radius: 999px; background: #c9514b; color: #fff; padding: 0 4px; font-size: 9px; font-weight: 800; line-height: 16px; text-align: center; }
	.notification-toggle {
		display: flex;
		align-items: center;
		gap: 7px;
		border: 0;
		background: transparent;
		color: #c3d3c0;
		padding: 4px 0;
		font: inherit;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.notification-toggle:disabled { cursor: wait; opacity: .65; }
	.toggle-label { white-space: nowrap; }
	.toggle-track {
		position: relative;
		display: block;
		width: 34px;
		height: 19px;
		border-radius: 999px;
		background: #526b5a;
		transition: background .2s ease;
	}
	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		background: #f5f7f0;
		transition: transform .2s ease;
	}
	.notification-toggle.on { color: #f7d88f; }
	.notification-toggle.on .toggle-track { background: #6eaa78; }
	.notification-toggle.on .toggle-thumb { transform: translateX(15px); }
	.profile-link {
		display: flex;
		align-items: center;
		gap: 9px;
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: #dcebd8;
		color: #39754b;
		font-weight: 800;
	}
	.auth-actions {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.link-btn {
		background: transparent;
		color: #c3d3c0;
		border: none;
		padding: 8px 4px;
		font: 700 13px 'DM Sans', sans-serif;
		cursor: pointer;
		transition: color 0.2s;
	}
	.link-btn:hover { color: #f7d88f; }
	.signup-btn {
		border: 1px solid #6eaa78;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 10px 14px;
		font: 700 13px 'DM Sans', sans-serif;
		cursor: pointer;
		transition: background 0.2s, transform 0.2s;
	}
	.signup-btn:hover { background: #2f633f; transform: translateY(-1px); }

	.header-spacer {
		height: 76px;
		flex-shrink: 0;
	}

	.app-main {
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
	}

	.notification-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 20px;
		background: #12271db8;
	}
	.notification-modal {
		position: relative;
		width: min(100%, 470px);
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #f5f7f0;
		box-shadow: 0 24px 70px #12271d45;
		padding: 34px;
		color: #183126;
	}
	.modal-close {
		position: absolute;
		top: 14px;
		right: 16px;
		border: 0;
		background: transparent;
		color: #718077;
		font-size: 25px;
		line-height: 1;
		cursor: pointer;
	}
	.modal-kicker {
		color: #39754b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: .14em;
		text-transform: uppercase;
	}
	.notification-modal h2 {
		max-width: 360px;
		margin: 12px 0 10px;
		font: 600 31px/1.05 'Fraunces', Georgia, serif;
	}
	.notification-modal p {
		margin: 0;
		color: #52705a;
		font-size: 14px;
		line-height: 1.6;
	}
	.modal-actions { display: flex; gap: 10px; margin-top: 24px; }
	.modal-primary, .modal-secondary {
		border-radius: 7px;
		padding: 11px 14px;
		font: 700 12px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.modal-primary { border: 1px solid #39754b; background: #39754b; color: #fff; }
	.modal-secondary { border: 1px solid #a9c9aa; background: transparent; color: #39754b; }
	.snooze-option { display: flex; align-items: center; gap: 8px; margin-top: 18px; color: #718077; font-size: 11px; }
	.snooze-option input { accent-color: #39754b; }

	.app-footer {
		margin-top: auto;
		background: #183126;
		color: #c3d3c0;
		flex-shrink: 0;
	}
	.footer-inner {
		max-width: 1180px;
		margin: auto;
		padding: 44px 28px 40px;
		display: grid;
		grid-template-columns: 1.2fr 1fr auto;
		gap: 30px;
		align-items: start;
	}
	.footer-brand {
		color: #fff;
		font: 700 22px 'DM Sans', sans-serif;
		text-decoration: none;
	}
	.footer-brand-col p {
		margin: 10px 0 0;
		color: #82948a;
		font-size: 14px;
		line-height: 1.5;
	}
	.footer-links {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px 24px;
	}
	.footer-links a {
		color: #c3d3c0;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		transition: color 0.2s;
	}
	.footer-links a:hover { color: #f7d88f; }
	.copyright {
		color: #6d8074;
		font-size: 12px;
		text-align: right;
		align-self: end;
	}

	@media (max-width: 1180px) {
		.header-inner { position: relative; padding: 0 22px; gap: 14px; }
		.brand { flex: 1 1 auto; }
		.nav-toggle { display: grid; }
		.main-nav { position: absolute; top: 100%; right: 0; left: 0; z-index: 1; display: none; max-height: calc(100vh - 76px); overflow-y: auto; flex-direction: column; flex-wrap: nowrap; align-items: stretch; justify-content: flex-start; gap: 0; padding: 8px 18px 16px; background: #183126; box-shadow: 0 12px 18px #12271d30; }
		.main-nav.open { display: flex; }
		.main-nav a { padding: 12px 8px; border-bottom: 1px solid #355141; }
		.footer-inner { grid-template-columns: 1fr; }
		.footer-links { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.copyright { text-align: left; }
	}
	@media (max-width: 520px) {
		.header-inner { min-height: 68px; padding: 0 14px; gap: 8px; }
		.brand-text { display: none; }
		.header-actions { gap: 6px; }
		.toggle-label, .profile-link > span:last-child { display: none; }
		.header-spacer { height: 68px; }
		.footer-links { grid-template-columns: 1fr 1fr; }
	}
</style>
