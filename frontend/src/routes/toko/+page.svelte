<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getMyShop, getMyShopProducts, type Shop, type MyProductsResponse } from '$lib/api/shop-api';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { getSellerOrdersManage, type SellerManageResponse } from '$lib/api/order-api';
	import Card from '$lib/components/Card.svelte';

	let currentUser = $state<CurrentUserDto | null>(null);
	let shop = $state<Shop | null>(null);
	let hasShop = $state<boolean | null>(null);
	let products = $state<MyProductsResponse['data']>([]);
	let availableProducts = $derived(
		products.filter((product) =>
			product.is_pre_order
				? product.po_quota_kg > product.po_booked_kg
				: product.stock > product.po_booked_kg
		)
	);
	let exhaustedProducts = $derived(
		products.filter((product) =>
			product.is_pre_order
				? product.po_quota_kg <= product.po_booked_kg
				: product.stock <= product.po_booked_kg
		)
	);
	let ordersManage = $state<SellerManageResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
		} catch {
			currentUser = null;
			await goto('/signin');
			return;
		}
		await loadDashboard();
	});

	async function loadDashboard() {
		isLoading = true;
		errorMessage = '';
		try {
			const [shopRes, productsRes, ordersRes] = await Promise.all([
				getMyShop(),
				getMyShopProducts().catch(() => ({ message: '', data: [] })),
				getSellerOrdersManage('all').catch(() => null),
			]);
			hasShop = shopRes.has_shop;
			shop = shopRes.shop;
			products = productsRes.data || [];
			ordersManage = ordersRes;
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat dashboard toko.';
		} finally {
			isLoading = false;
		}
	}

	function formatPrice(value: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function productImage(image_url: string[]) {
		return image_url?.[0] || '';
	}
</script>

<svelte:head><title>Dashboard Toko | Tani Siaga</title></svelte:head>

<div class="shop-wrap">
	<div class="shop-main">
		{#if isLoading}
			<div class="state">Memuat dashboard toko...</div>
		{:else if errorMessage}
			<div class="state error">{errorMessage}<button onclick={loadDashboard}>Coba lagi</button></div>
		{:else if !hasShop}
			<section class="no-shop">
				<div class="no-shop-card">
					<div class="no-shop-icon">🌾</div>
					<p class="eyebrow">TOKO BELUM TERSEDIA</p>
					<h1>Anda belum punya toko.</h1>
					<p class="subtitle">Buat toko untuk mulai menjual hasil panen langsung ke pembeli melalui Tani Siaga.</p>
					<div class="cta-row">
						<a class="primary-btn" href="/toko/create">Buat Toko Sekarang ↗</a>
						<a class="secondary-btn" href="/dashboard">Kembali ke Dashboard</a>
					</div>
					<ul class="benefits">
						<li><strong>✓</strong> Kelola produk dan stok panen dengan mudah</li>
						<li><strong>✓</strong> Dapatkan pesanan dari pembeli langsung</li>
						<li><strong>✓</strong> Lacak status konfirmasi pesanan secara real-time</li>
					</ul>
				</div>
			</section>
		{:else}
			<section class="hero">
				<div class="hero-copy">
					<p class="eyebrow">DASHBOARD TOKO</p>
					<h1>{shop?.name || 'Toko Saya'}</h1>
					<p class="hero-location">📍 {shop?.location || 'Lokasi belum diatur'}</p>
					<div class="hero-meta">
						<span class="meta-phone">📞 {shop?.phone_number}</span>
					</div>
					<p class="hero-desc">{shop?.description}</p>
					<div class="hero-actions">
						<a class="primary-btn" href="/toko/pesanan">Kelola Pesanan {ordersManage?.counts?.seller_pending ? `(${ordersManage.counts.seller_pending} belum dikonfirmasi)` : ''}</a>
						<a class="secondary-btn" href="/e-commerce">Lihat Katalog</a>
					</div>
				</div>
				<div class="hero-stats">
					<div class="stat-card accent">
						<span class="stat-num">{products.length}</span>
						<span class="stat-label">Produk terdaftar</span>
					</div>
					<div class="stat-card pending">
						<span class="stat-num">{ordersManage?.counts?.seller_pending ?? 0}</span>
						<span class="stat-label">Pesanan butuh konfirmasi</span>
					</div>
					<div class="stat-card done">
						<span class="stat-num">{ordersManage?.counts?.seller_unconfirmed ?? 0}</span>
						<span class="stat-label">Belum dikonfirmasi kedua pihak</span>
					</div>
				</div>
			</section>

			<section class="products-section">
				<div class="section-title">
					<div>
						<p class="eyebrow">DAFTAR PRODUK TOKO</p>
						<h2>Kelola produk dan stokmu</h2>
					</div>
					<div class="section-actions">
						<a class="link-all" href="/toko/pesanan">Lihat semua pesanan →</a>
						<a class="primary-btn create-btn" href="/toko/produk/create">+ Buat Produk</a>
					</div>
				</div>

				{#if products.length === 0}
					<div class="empty-products">
						<p>Belum ada produk di toko ini. Silakan buat produk terlebih dahulu.</p>
						<a class="primary-btn" href="/toko/produk/create">+ Buat Produk Pertama</a>
					</div>
				{:else if availableProducts.length === 0}
					<div class="empty-products">
						<p>Semua produk sedang habis.</p>
					</div>
				{:else}
					<div class="products-grid">
						{#each availableProducts as product (product.id)}
							<Card
								product={product}
								actionHref={`/toko/produk/${product.id}`}
								actionLabel="Edit / Hapus Produk →"
							/>
						{/each}
					</div>
				{/if}
			</section>

			{#if exhaustedProducts.length > 0}
				<section class="products-section exhausted-section">
					<div class="section-title">
						<div>
							<p class="eyebrow">STOK 0 / KUOTA PENUH</p>
							<h2>Produk Habis</h2>
						</div>
						<span class="exhausted-count">{exhaustedProducts.length} produk</span>
					</div>
					<div class="products-grid">
						{#each exhaustedProducts as product (product.id)}
							<Card
								product={product}
								actionHref={`/toko/produk/${product.id}`}
								actionLabel="Edit / Hapus Produk →"
							/>
						{/each}
					</div>
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	.shop-wrap { flex: 1; color: #183126; }

	.shop-main { max-width: 1180px; margin: auto; padding: 30px 28px 70px; }

	.state {
		padding: 60px 40px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		color: #718077;
	}
	.state.error { color: #a44242; background: #fff0ef; }
	.state button {
		display: block;
		margin: 18px auto 0;
		border: 1px solid #39754b;
		background: #fff;
		color: #39754b;
		padding: 10px 18px;
		border-radius: 7px;
		font-weight: 700;
		cursor: pointer;
	}

	.no-shop {
		display: grid;
		place-items: center;
		padding: 30px 20px;
	}
	.no-shop-card {
		max-width: 620px;
		padding: 50px 44px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 14px;
		background: #fff;
		box-shadow: 0 12px 34px #23472e10;
	}
	.no-shop-icon { font-size: 72px; margin-bottom: 16px; }
	.eyebrow {
		margin: 0 0 10px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.no-shop-card h1 {
		margin: 0;
		font: 600 clamp(32px, 5vw, 52px)/1 'Fraunces', Georgia, serif;
	}
	.subtitle {
		margin: 16px auto 30px;
		color: #718077;
		line-height: 1.6;
		max-width: 460px;
	}
	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		justify-content: center;
		margin-bottom: 32px;
	}
	.primary-btn {
		display: inline-block;
		padding: 14px 20px;
		border-radius: 8px;
		background: #39754b;
		color: #fff;
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
		box-shadow: 0 8px 18px #39754b26;
	}
	.secondary-btn {
		display: inline-block;
		padding: 14px 20px;
		border-radius: 8px;
		background: #fff;
		color: #39754b;
		border: 1px solid #a9c9aa;
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
	}
	.benefits {
		list-style: none;
		padding: 24px 0 0;
		margin: 0;
		text-align: left;
		border-top: 1px dashed #d6e1d5;
		display: grid;
		gap: 10px;
		color: #385540;
		font-size: 14px;
	}
	.benefits strong { color: #39754b; margin-right: 8px; }

	.hero {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 40px;
		align-items: stretch;
		margin-bottom: 52px;
	}
	.hero-copy {
		padding: 34px 36px;
		border: 1px solid #31543e;
		border-radius: 14px;
		background: #183126;
		box-shadow: 0 8px 24px #23472e0c;
	}
	.hero-copy h1 {
		margin: 0;
		color: #fff;
		font: 600 clamp(36px, 5vw, 58px)/1 'Fraunces', Georgia, serif;
	}
	.hero-location {
		margin: 14px 0 8px;
		color: #f4d69d;
		font-size: 15px;
		font-weight: 700;
	}
	.hero-meta {
		color: #a8c7aa;
		font-size: 13px;
	}
	.hero-desc {
		margin: 22px 0 28px;
		color: #d6e1d5;
		line-height: 1.65;
	}
	.hero-copy .eyebrow {
		color: #8ec18d;
	}
	.hero-copy .primary-btn {
		background: #4f9361;
		box-shadow: none;
	}
	.hero-copy .secondary-btn {
		border-color: #6c9b72;
		background: transparent;
		color: #fff;
	}
	.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; }
	.hero-stats {
		display: grid;
		grid-template-rows: repeat(3, 1fr);
		gap: 14px;
	}
	.stat-card {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 6px;
		padding: 24px 20px;
		border-radius: 12px;
		background: #fff;
		border: 1px solid #d6e1d5;
	}
	.stat-num {
		font: 700 42px 'Fraunces', Georgia, serif;
		color: #183126;
	}
	.stat-label {
		color: #718077;
		font-size: 12px;
		font-weight: 700;
		text-align: center;
	}
	.stat-card.accent { background: #dcebd8; border-color: #b5d4b1; }
	.stat-card.accent .stat-num { color: #39754b; }
	.stat-card.pending { background: #fff8e8; border-color: #f1dfb1; }
	.stat-card.pending .stat-num { color: #98702d; }
	.stat-card.done { background: #edf8ed; border-color: #b8dbb8; }
	.stat-card.done .stat-num { color: #2f6a41; }

	.section-title {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 22px;
	}
	.section-title h2 {
		margin: 0;
		font: 600 clamp(26px, 3.5vw, 38px)/1 'Fraunces', Georgia, serif;
	}
	.section-actions {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.create-btn { padding: 11px 18px; box-shadow: 0 6px 14px #39754b22; }
	.link-all {
		color: #39754b;
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
	}
	.empty-products {
		padding: 54px 34px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		color: #718077;
	}
	.empty-products p { margin: 0 0 24px; }
	.products-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 18px;
	}
	.exhausted-section { margin-top: 44px; padding-top: 32px; border-top: 1px solid #d6e1d5; }
	.exhausted-count { color: #718077; font-size: 13px; font-weight: 700; }
	@media (max-width: 960px) {
		.hero { grid-template-columns: 1fr; }
		.products-grid { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 600px) {
		.products-grid { grid-template-columns: 1fr; }
	}
</style>
