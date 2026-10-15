<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import Modal from '$lib/components/Modal.svelte';
	import '../app.css';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { applyAccountTheme, applyStoredAccountTheme } from '$lib/services/theme';
	import { showAlert } from '$lib/services/dialog';
	import { getNotifications } from '$lib/api/notification-api';
	import { disablePushNotifications, enablePushNotifications, getNotificationPermission, syncPushToken } from '$lib/services/notificationService';

	let { children } = $props();
	const authRoutes = new Set(['/signin', '/signup', '/forgot-password']);
	function isAuthPath(pathname: string) {
		return authRoutes.has(pathname.replace(/\/+$/, '') || '/');
	}
	let isAuthRoute = $derived(isAuthPath($page.url.pathname));

	let currentUser = $state<CurrentUserDto | null>(null);
	if (browser) applyStoredAccountTheme();
	let authRedirectStarted = false;
	type NotificationState = NotificationPermission | 'unsupported' | 'off' | 'loading' | 'error';
	let notificationState = $state<NotificationState>('default');
	let notificationPromptOpen = $state(false);
	let doNotRemind = $state(false);
	let promptedUserKey = '';
	let unreadNotificationCount = $state(0);
	const baseNavLinks = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/ai-recommendations', label: 'Rekomendasi AI' },
		{ href: '/market-analysis', label: 'Analisis Pasar' },
		{ href: '/e-commerce', label: 'E-Commerce' },
		{ href: '/kelompok-tani', label: 'Kelompok Tani' },
		{ href: '/lahan-tani', label: 'Lahan Tani' },
		{ href: '/komoditas', label: 'Komoditas' },
		{ href: '/toko', label: 'Toko' },
	];
	const aboutNavLink = { href: '/tentang-kami', label: 'Tentang Kami' };
	let navLinks = $derived([
		...baseNavLinks,
		...(currentUser?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
		aboutNavLink,
	]);

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

	async function loadCurrentUser(pathname = $page.url.pathname) {
		try {
			currentUser = await getCurrentUser();
			applyAccountTheme(currentUser);
			if (isAuthPath(pathname) && isAuthPath($page.url.pathname)) {
				if (!authRedirectStarted) {
					authRedirectStarted = true;
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
			applyStoredAccountTheme();
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
			const pathname = $page.url.pathname;
			void tick();
			if (browser) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
			await loadCurrentUser(pathname);
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
			const target = event.target;
			const nav = target instanceof Element ? target.closest<HTMLElement>('.navigasi-utama') : null;
			if (!nav || !node.contains(nav)) {
				event.preventDefault();
				return;
			}

			if (window.matchMedia('(max-width: 1180px)').matches) return;

			event.preventDefault();

			const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
			const maxScrollLeft = nav.scrollWidth - nav.clientWidth;
			const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, nav.scrollLeft + delta));
			nav.scrollLeft = nextScrollLeft;
		}

		node.addEventListener('wheel', onWheel, { passive: false, capture: true });
		return { destroy: () => node.removeEventListener('wheel', onWheel, { capture: true }) };
	}

	let initials = $derived(currentUser?.email?.slice(0, 1).toUpperCase() || 'G');
</script>

<svelte:head>
	<link rel="icon" href="/tani-siaga-logo.svg" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="kerangka-aplikasi">
	{#if !isAuthRoute}
	<header class="bilah-aplikasi" class:tersembunyi={headerHidden} class:memudar={headerFading} use:horizontalWheelScroll>
		<div class="dalam-bilah">
			<a class="merek" href="/dashboard" aria-label="Tani Siaga Dashboard">
				<img class="penanda-merek" src="/tani-siaga-logo.svg" alt="" />
				<span class="teks-merek">Tani Siaga</span>
			</a>
			<button class="alih-navigasi" type="button" aria-label={mobileNavOpen ? 'Tutup navigasi' : 'Buka navigasi'} aria-expanded={mobileNavOpen} aria-controls="navigasi-utama" onclick={() => (mobileNavOpen = !mobileNavOpen)}>
				<span aria-hidden="true">{mobileNavOpen ? '×' : '☰'}</span>
			</button>
			<nav id="navigasi-utama" class="navigasi-utama" class:buka={mobileNavOpen} aria-label="Navigasi utama">
				{#each navLinks as link}
					<a href={link.href} class:aktif={isActive(link.href)} onclick={() => (mobileNavOpen = false)}>{link.label}</a>
				{/each}
			</nav>
			<div class="aksi-bilah">
				{#if currentUser}
					<a class="tautan-notifikasi" href="/notifikasi" aria-label={`Notifikasi${unreadNotificationCount ? `, ${unreadNotificationCount} belum dibaca` : ''}`}>
						<span class="lonceng" aria-hidden="true">🔔</span>
						{#if unreadNotificationCount > 0}<span class="lencana-notifikasi">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>{/if}
					</a>
					<button
						class="alih-notifikasi"
						class:aktif={notificationState === 'granted'}
						role="switch"
						aria-checked={notificationState === 'granted'}
						aria-label={notificationState === 'granted' ? 'Matikan notifikasi' : 'Nyalakan notifikasi'}
						onclick={toggleNotifications}
						disabled={notificationState === 'loading'}
					>
						<span class="label-alih">Notifikasi</span>
						<span class="jalur-alih"><span class="penggeser-alih"></span></span>
					</button>
					<a class="tautan-profil" href="/profil">
						<span class="foto">{#if currentUser.profile_image_url}<img src={currentUser.profile_image_url} alt="" />{:else}{initials}{/if}</span>
						<span>Profil</span>
					</a>
				{:else}
					<div class="aksi-autentikasi">
						<button class="tombol-tautan" onclick={goToSignin}>Sign in</button>
						<button class="tombol-daftar" onclick={goToSignup}>Sign up</button>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<div class="pemisah-bilah"></div>
	{/if}

	<main class="utama-aplikasi">
		{@render children()}
	</main>
	<Modal />

	{#if notificationPromptOpen}
		<div class="latar-notifikasi" role="presentation">
			<dialog open class="dialog-notifikasi" aria-labelledby="judul-notifikasi">
				<button class="tutup-dialog" aria-label="Tutup" onclick={closeNotificationPrompt}>×</button>
				<span class="label-dialog">Pemberitahuan penting</span>
				<h2 id="judul-notifikasi">Jangan lewatkan kabar dari lahanmu.</h2>
				<p>Aktifkan notifikasi untuk menerima perubahan prediksi cuaca, analisis pasar, rekomendasi lahan, dan pembaruan pesanan toko.</p>
				<div class="aksi-dialog">
					<button class="utama-dialog" onclick={toggleNotifications}>Aktifkan notifikasi</button>
					<button class="pendukung-dialog" onclick={closeNotificationPrompt}>Nanti saja</button>
				</div>
				<label class="opsi-tunda">
					<input type="checkbox" bind:checked={doNotRemind} />
					<span>Jangan ingatkan saya selama 7 hari</span>
				</label>
			</dialog>
		</div>
	{/if}

	{#if !isAuthRoute}
	<footer class="kaki-halaman-aplikasi">
		<div class="dalam-kaki-halaman">
			<div class="kolom-merek-kaki-halaman">
				<a class="merek-kaki-halaman" href="/dashboard"><img src="/tani-siaga-logo.svg" alt="" />Tani Siaga</a>
				<p>Teknologi yang tumbuh bersama petani.</p>
			</div>
			<div class="tautan-kaki-halaman">
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
			<span class="hak-cipta">© {new Date().getFullYear()} Tani Siaga</span>
		</div>
	</footer>
	{/if}
</div>

<style>
	.kerangka-aplikasi {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #f5f7f0;
		color: #183126;
	}
	.bilah-aplikasi {
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
	.bilah-aplikasi.tersembunyi {
		transform: translateY(-102%);
		opacity: 0;
		pointer-events: none;
		box-shadow: none;
	}
	.dalam-bilah {
		display: flex;
		align-items: center;
		gap: 36px;
		max-width: 1280px;
		min-height: 76px;
		margin: auto;
		padding: 0 38px;
	}
	.merek {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		flex: 0 0 auto;
		color: #fff;
		font: 700 10px 'DM Sans', sans-serif;
		line-height: 1.1;
		text-decoration: none;
		white-space: nowrap;
	}
	.penanda-merek {
		display: block;
		width: 42px;
		height: 42px;
		object-fit: contain;
	}
	.teks-merek {
		letter-spacing: 0;
	}
	.alih-navigasi {
		display: none;
		width: 40px;
		height: 40px;
		place-items: center;
		flex: 0 0 auto;
		border: 1px solid #526b5a;
		border-radius: 7px;
		background: transparent;
		color: #fff;
		font-size: 21px;
		line-height: 1;
		cursor: pointer;
	}
	.navigasi-utama {
		display: flex;
		min-width: 0;
		justify-content: flex-start;
		gap: 24px;
		flex: 1 1 0;
		flex-wrap: nowrap;
		overflow-x: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
	}
	.navigasi-utama::-webkit-scrollbar {
		display: none;
	}
	.navigasi-utama a {
		flex: 0 0 auto;
	}
	.navigasi-utama a {
		color: #c3d3c0;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		transition: color 0.2s;
		padding: 6px 2px;
		border-bottom: 2px solid transparent;
	}
	.navigasi-utama a:hover {
		color: #f7d88f;
	}
	.navigasi-utama a.aktif {
		color: #fff;
		border-bottom-color: #f7d88f;
	}
	.aksi-bilah {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		flex: 0 0 auto;
	}
	.tautan-notifikasi {
		position: relative;
		display: grid;
		place-items: center;
		width: 30px;
		height: 34px;
		color: #fff;
		text-decoration: none;
	}
	.lonceng {
		font-size: 17px;
		line-height: 1;
		filter: grayscale(1) brightness(2);
	}
	.lencana-notifikasi {
		position: absolute;
		top: 0;
		right: -3px;
		min-width: 16px;
		height: 16px;
		border-radius: 999px;
		background: #c9514b;
		color: #fff;
		padding: 0 4px;
		font-size: 9px;
		font-weight: 800;
		line-height: 16px;
		text-align: center;
	}
	.alih-notifikasi {
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
	.alih-notifikasi:disabled {
		cursor: wait;
		opacity: .65;
	}
	.label-alih {
		white-space: nowrap;
	}
	.jalur-alih {
		position: relative;
		display: block;
		width: 34px;
		height: 19px;
		border-radius: 999px;
		background: #526b5a;
		transition: background .2s ease;
	}
	.penggeser-alih {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		background: #f5f7f0;
		transition: transform .2s ease;
	}
	.alih-notifikasi.aktif {
		color: #f7d88f;
	}
	.alih-notifikasi.aktif .jalur-alih {
		background: #6eaa78;
	}
	.alih-notifikasi.aktif .penggeser-alih {
		transform: translateX(15px);
	}
	.tautan-profil {
		display: flex;
		align-items: center;
		gap: 9px;
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}
	.foto {
		display: grid;
		place-items: center;
		overflow: hidden;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: #dcebd8;
		color: #39754b;
		font-weight: 800;
	}
	.foto img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.aksi-autentikasi {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.tombol-tautan {
		background: transparent;
		color: #c3d3c0;
		border: none;
		padding: 8px 4px;
		font: 700 13px 'DM Sans', sans-serif;
		cursor: pointer;
		transition: color 0.2s;
	}
	.tombol-tautan:hover {
		color: #f7d88f;
	}
	.tombol-daftar {
		border: 1px solid #6eaa78;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 10px 14px;
		font: 700 13px 'DM Sans', sans-serif;
		cursor: pointer;
		transition: background 0.2s, transform 0.2s;
	}
	.tombol-daftar:hover {
		background: #2f633f;
		transform: translateY(-1px);
	}
	.pemisah-bilah {
		height: 76px;
		flex-shrink: 0;
	}
	.utama-aplikasi {
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
	}
	.latar-notifikasi {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 20px;
		background: #12271db8;
	}
	.dialog-notifikasi {
		position: relative;
		width: min(100%, 470px);
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #f5f7f0;
		box-shadow: 0 24px 70px #12271d45;
		padding: 34px;
		color: #183126;
	}
	.tutup-dialog {
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
	.label-dialog {
		color: #39754b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: .14em;
		text-transform: uppercase;
	}
	.dialog-notifikasi h2 {
		max-width: 360px;
		margin: 12px 0 10px;
		font: 600 31px/1.05 'Fraunces', Georgia, serif;
	}
	.dialog-notifikasi p {
		margin: 0;
		color: #52705a;
		font-size: 14px;
		line-height: 1.6;
	}
	.aksi-dialog {
		display: flex;
		gap: 10px;
		margin-top: 24px;
	}
	.utama-dialog, .pendukung-dialog {
		border-radius: 7px;
		padding: 11px 14px;
		font: 700 12px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.utama-dialog {
		border: 1px solid #39754b;
		background: #39754b;
		color: #fff;
	}
	.pendukung-dialog {
		border: 1px solid #a9c9aa;
		background: transparent;
		color: #39754b;
	}
	.opsi-tunda {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 18px;
		color: #718077;
		font-size: 11px;
	}
	.opsi-tunda input {
		accent-color: #39754b;
	}
	.kaki-halaman-aplikasi {
		margin-top: auto;
		background: #183126;
		color: #c3d3c0;
		flex-shrink: 0;
	}
	.dalam-kaki-halaman {
		max-width: 1180px;
		margin: auto;
		padding: 44px 28px 40px;
		display: grid;
		grid-template-columns: 1.2fr 1fr auto;
		gap: 30px;
		align-items: start;
	}
	.merek-kaki-halaman {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		color: #fff;
		font: 700 12px 'DM Sans', sans-serif;
		text-decoration: none;
	}
	.merek-kaki-halaman img {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}
	.kolom-merek-kaki-halaman p {
		margin: 10px 0 0;
		color: #82948a;
		font-size: 14px;
		line-height: 1.5;
	}
	.tautan-kaki-halaman {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px 24px;
	}
	.tautan-kaki-halaman a {
		color: #c3d3c0;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		transition: color 0.2s;
	}
	.tautan-kaki-halaman a:hover {
		color: #f7d88f;
	}
	.hak-cipta {
		color: #6d8074;
		font-size: 12px;
		text-align: right;
		align-self: end;
	}
	@media (max-width: 1180px) {
		.dalam-bilah {
			position: relative;
			padding: 0 22px;
			gap: 14px;
		}
		.merek {
			flex: 1 1 auto;
		}
		.alih-navigasi {
			display: grid;
		}
		.navigasi-utama {
			position: absolute;
			top: 100%;
			right: 0;
			left: 0;
			z-index: 1;
			display: none;
			max-height: calc(100vh - 76px);
			overflow-y: auto;
			flex-direction: column;
			flex-wrap: nowrap;
			align-items: stretch;
			justify-content: flex-start;
			gap: 0;
			padding: 8px 18px 16px;
			background: #183126;
			box-shadow: 0 12px 18px #12271d30;
		}
		.navigasi-utama.buka {
			display: flex;
		}
		.navigasi-utama a {
			padding: 12px 8px;
			border-bottom: 1px solid #355141;
		}
		.dalam-kaki-halaman {
			grid-template-columns: 1fr;
		}
		.tautan-kaki-halaman {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.hak-cipta {
			text-align: left;
		}
	}
	@media (max-width: 520px) {
		.dalam-bilah {
			min-height: 68px;
			padding: 0 14px;
			gap: 8px;
		}
		.aksi-bilah {
			gap: 6px;
		}
		.label-alih, .tautan-profil > span:last-child {
			display: none;
		}
		.pemisah-bilah {
			height: 68px;
		}
		.tautan-kaki-halaman {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
