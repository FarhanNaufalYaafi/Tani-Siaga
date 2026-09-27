<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { addToCart, getProductById, getProducts, type Product, type ProductWeatherForecast } from '$lib/api/product-api';
	import { getPublicShop, type PublicShopResponse } from '$lib/api/shop-api';
	import Card from '$lib/components/Card.svelte';

	let product = $state<Product | null>(null);
	let shop = $state<PublicShopResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let quantity = $state(1);
	let isAdding = $state(false);
	let purchaseMode = $state<'cart' | 'buy_now'>('cart');
	let notice = $state('');
	let recommendedReady = $state<Product[]>([]);
	let recommendedPreOrder = $state<Product[]>([]);
	let weatherRange = $state<'today' | 'tomorrow' | 'later'>('today');

	let harvestByKg = $derived(Boolean(product?.is_pre_order || product?.farmland_id));
	let availableQuantity = $derived(product ? product.is_pre_order ? Math.max(0, product.po_quota_kg - product.po_booked_kg) : Math.max(0, product.stock - product.po_booked_kg) : 0);
	let bookedPercentage = $derived(product && product.po_quota_kg > 0 ? Math.min(100, Math.round((product.po_booked_kg / product.po_quota_kg) * 100)) : 0);
	let visibleForecasts = $derived.by(() => {
		const forecasts = product?.weather_forecasts || [];
		if (weatherRange === 'today') return forecasts.slice(0, 4);
		if (weatherRange === 'tomorrow') return forecasts.slice(4, 8);
		return forecasts.slice(8, 12);
	});

	$effect(() => {
		if (availableQuantity > 0 && quantity > availableQuantity) {
			quantity = availableQuantity;
		}
	});

	async function loadProduct(id: string) {
		isLoading = true;
		errorMessage = '';
		shop = null;
		recommendedReady = [];
		recommendedPreOrder = [];
		try {
			product = await getProductById(id);
			if (product.shop?.id) shop = await getPublicShop(product.shop.id);
			const [readyStock, preOrder] = await Promise.all([
				getProducts('ready_stock', 1, 5),
				getProducts('pre_order', 1, 5),
			]);
			const currentProductId = Number(product.id);
			recommendedReady = readyStock.data.filter((item) => Number(item.id) !== currentProductId).slice(0, 4);
			recommendedPreOrder = preOrder.data.filter((item) => Number(item.id) !== currentProductId).slice(0, 4);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat produk.';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		const id = page.params.id;
		if (id) void loadProduct(id);
	});

	function price(value: number) {
		return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
	}

	function date(value: string | null | undefined) {
		return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '-';
	}

	function forecastDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', {
			weekday: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(value));
	}

	function image(item: Product | PublicShopResponse['products'][number]) {
		return item.image_url?.[0] || '';
	}

	async function add() {
		if (!product) return;
		if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > availableQuantity) {
			errorMessage = `Jumlah melebihi ketersediaan. Maksimal ${availableQuantity} kg.`;
			return;
		}
		isAdding = true;
		purchaseMode = 'cart';
		notice = '';
		errorMessage = '';
		try {
			await addToCart(product.id, Number(quantity));
			notice = 'Produk berhasil ditambahkan ke keranjang.';
		} catch (error: any) {
			if (error.message?.toLowerCase().includes('unauthorized') || error.message?.toLowerCase().includes('login')) await goto('/signin');
			else errorMessage = error.message || 'Gagal menambahkan produk.';
		} finally {
			isAdding = false;
		}
	}

	async function buyNow() {
		if (!product) return;
		if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > availableQuantity) {
			errorMessage = `Jumlah harus antara 1 dan ${availableQuantity}.`;
			return;
		}
		isAdding = true;
		purchaseMode = 'buy_now';
		notice = '';
		errorMessage = '';
		try {
			const result = await addToCart(product.id, Number(quantity));
			await goto(`/checkout/${result.data.id}`);
		} catch (error: any) {
			if (error.message?.toLowerCase().includes('unauthorized') || error.message?.toLowerCase().includes('login')) await goto('/signin');
			else errorMessage = error.message || 'Gagal memulai checkout.';
		} finally {
			isAdding = false;
		}
	}

	function changeQuantity(delta: number) {
		quantity = Math.min(Math.max(1, Number(quantity || 1) + delta), Math.max(1, availableQuantity));
	}
</script>

<svelte:head>
	<title>{product ? `${product.name} | E-Commerce` : 'Detail Produk'}</title>
</svelte:head>

<div class="page-shell">
	<div class="page-container">
		<a class="back" href="/e-commerce">← Kembali ke katalog</a>
		{#if isLoading}
			<div class="state">Memuat produk...</div>
		{:else if errorMessage && !product}
			<div class="state error">{errorMessage}</div>
		{:else if product}
			<section class="product-detail">
				<div class="visual">
					{#if image(product)}
						<img src={image(product)} alt={product.name} />
					{:else}
						<span class="placeholder">🌾</span>
					{/if}
					<span class:po={product.is_pre_order} class="tag">{product.is_pre_order ? 'PRE-ORDER HASIL PANEN' : 'READY STOCK'}</span>
				</div>
				<div class="content">
					<p class="eyebrow">PRODUK DARI PETANI LOKAL</p>
					<h1>{product.name}</h1>
					<strong class="price">{price(product.price)}</strong>
					{#if product.is_pre_order}
						<div class="metric-panel po-panel">
							<div class="metric-heading"><span>Kuota pre-order terisi</span><strong>{bookedPercentage}%</strong></div>
							<progress class="progress-track" max="100" value={bookedPercentage}></progress>
							<div class="metric-details"><span>{product.po_booked_kg} kg sudah dipesan</span><span>{availableQuantity} kg tersisa</span></div>
						</div>
						{#if product.estimated_harvest_date}<p class="harvest">Perkiraan panen {date(product.estimated_harvest_date)}</p>{/if}
					{:else}
						<div class="metric-panel ready-panel">
							<span>Jumlah terjual</span>
							<strong>{product.sold_quantity || 0} unit</strong>
							<small>{product.stock} {harvestByKg ? 'kg stok total' : 'unit stok total'}</small>
							{#if product.po_booked_kg > 0}<small>{product.po_booked_kg} kg dikunci untuk pre-order</small>{/if}
							<small>{availableQuantity} {harvestByKg ? 'kg' : 'unit'} masih tersedia</small>
						</div>
					{/if}
					<div class="buy-row">
						<label>Jumlah
							<span class="quantity-control">
								<button type="button" aria-label="Kurangi jumlah" onclick={() => changeQuantity(-1)} disabled={quantity <= 1}>−</button>
								<input type="number" min="1" max={Math.max(1, availableQuantity)} step="1" bind:value={quantity} onblur={() => { quantity = Math.min(Math.max(1, Math.floor(Number(quantity) || 1)), Math.max(1, availableQuantity)); }} />
								<button type="button" aria-label="Tambah jumlah" onclick={() => changeQuantity(1)} disabled={quantity >= availableQuantity}>+</button>
							</span>
						</label>
						<div class="purchase-actions">
							<button class="cart-action" onclick={add} disabled={isAdding || availableQuantity < 1}>{isAdding && purchaseMode === 'cart' ? 'Menambahkan...' : 'Tambah ke keranjang'}</button>
							<button class="buy-now-action" onclick={buyNow} disabled={isAdding || availableQuantity < 1}>{isAdding && purchaseMode === 'buy_now' ? 'Menyiapkan checkout...' : 'Beli sekarang'}</button>
						</div>
					</div>
					{#if notice}<div class="notice">{notice} <a href="/keranjang">Lihat keranjang</a></div>{/if}
					{#if errorMessage}<div class="notice error">{errorMessage}</div>{/if}
				</div>
			</section>

			{#if shop}
				<section class="shop-strip">
					<div><p class="eyebrow">TOKO PENJUAL</p><h2>{shop.shop.name}</h2><p>{shop.shop.location}</p></div>
					<a class="shop-link" href={`/e-commerce/toko/${shop.shop.id}`}>Lihat detail toko <span>↗</span></a>
				</section>
			{/if}

			{#if product.is_pre_order}
				<details class="detail-dropdown weather-dropdown" open>
					<summary>
						<span><span class="source-logo">BMKG</span><strong>Prediksi cuaca lahan</strong></span>
						<small>Snapshot dari analisis lahan, bukan request BMKG baru</small>
					</summary>
					{#if product.weather_forecasts?.length}
						<div class="weather-tabs">
							<button class:active={weatherRange === 'today'} onclick={() => (weatherRange = 'today')}>Beberapa jam</button>
							<button class:active={weatherRange === 'tomorrow'} onclick={() => (weatherRange = 'tomorrow')} disabled={!product.weather_forecasts?.slice(4, 8).length}>Hari berikutnya</button>
							<button class:active={weatherRange === 'later'} onclick={() => (weatherRange = 'later')} disabled={!product.weather_forecasts?.slice(8, 12).length}>Hari setelahnya</button>
						</div>
						{#if visibleForecasts.length}
							<div class="weather-list">
								{#each visibleForecasts as weather}
									<div class="weather-row">
										<div><strong>{forecastDate(weather.datetime)}</strong><span>{weather.weather_name}</span></div>
										<div class="weather-main"><strong>{weather.temperature}°C</strong><span>Hujan {weather.precipitation} mm</span></div>
										<div class="weather-meta"><span>💧 {weather.humidity}%</span><span>Angin {weather.wind_speed} km/j</span></div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="muted">Rentang waktu ini belum tersedia pada snapshot analisis lahan.</p>
						{/if}
						<footer class="source-footer">Data prakiraan cuaca © Badan Meteorologi, Klimatologi, dan Geofisika (BMKG).</footer>
					{:else}
						<p class="muted">Prediksi cuaca lahan belum tersedia dari analisis petani.</p>
					{/if}
				</details>
			{/if}

			<details class="detail-dropdown description-dropdown">
				<summary>Deskripsi produk</summary>
				<p>{product.description}</p>
			</details>

			<section class="more-products">
				<div class="section-heading"><div><p class="eyebrow">REKOMENDASI PRODUK</p><h2>Temukan kebutuhan tani lainnya</h2></div><a href="/e-commerce">Buka semua produk →</a></div>
				{#if recommendedReady.length}
					<h3 class="recommendation-title">Ready Stock</h3>
					<div class="related-grid">
						{#each recommendedReady as item (item.id)}
							<Card product={item} />
						{/each}
					</div>
				{/if}
				{#if recommendedPreOrder.length}
					<h3 class="recommendation-title">Pre-Order</h3>
					<div class="related-grid">
						{#each recommendedPreOrder as item (item.id)}
							<Card product={item} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</div>
</div>

<style>
	.page-shell { min-height: 100vh; background: #f5f7f0; color: #183126; padding: 38px 20px 80px; }
	.page-container { max-width: 1120px; margin: 0 auto; }
	.back { display: inline-block; margin-bottom: 28px; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.product-detail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 58px; align-items: center; border: 1px solid #d6e1d5; border-radius: 12px; background: #fff; padding: 28px; box-shadow: 0 10px 26px #23472e0a; }
	.visual { position: relative; display: grid; place-items: center; min-height: 470px; overflow: hidden; border-radius: 10px; background: #dcebd8; }
	.visual img { width: 100%; height: 100%; object-fit: cover; }
	.placeholder { font-size: 100px; }
	.tag { border-radius: 5px; background: #183126; color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .08em; }
	.tag { position: absolute; top: 16px; left: 16px; padding: 8px 10px; }
	.tag.po { background: #a8762e; }
	.eyebrow { margin: 0 0 12px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .15em; }
	.content h1 { margin: 0 0 16px; font: 600 clamp(38px, 5vw, 62px) / 1 'Fraunces', Georgia, serif; }
	.price { display: block; color: #39754b; font-size: 25px; }
	.metric-panel { margin-top: 22px; border-radius: 8px; padding: 16px; }
	.po-panel { background: #fff8eb; color: #805a22; }
	.ready-panel { display: grid; gap: 4px; background: #edf8ed; color: #39754b; }
	.metric-heading, .metric-details { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.metric-heading span, .metric-details, .ready-panel span, .ready-panel small { font-size: 12px; }
	.metric-heading strong, .ready-panel strong { font-size: 23px; }
	.progress-track { width: 100%; height: 8px; margin: 12px 0 9px; overflow: hidden; border: 0; border-radius: 999px; background: #ecdcbf; }
	.progress-track::-webkit-progress-bar { border-radius: inherit; background: #ecdcbf; }
	.progress-track::-webkit-progress-value { border-radius: inherit; background: #a8762e; }
	.progress-track::-moz-progress-bar { border-radius: inherit; background: #a8762e; }
	.harvest { margin: 10px 0 0; color: #718077; font-size: 12px; }
	.buy-row { display: flex; align-items: end; gap: 12px; margin-top: 28px; flex-wrap: wrap; }
	.buy-row label { display: grid; gap: 7px; color: #52705a; font-size: 11px; font-weight: 700; }
	.quantity-control { display: flex; height: 44px; border: 1px solid #b7d0b6; border-radius: 7px; overflow: hidden; background: #fff; }
	.quantity-control button { width: 38px; border: 0; background: #f3f8f1; color: #39754b; font-size: 19px; cursor: pointer; }
	.quantity-control button:disabled { color: #9aaa9c; cursor: not-allowed; }
	.quantity-control input { width: 48px; border: 0; border-right: 1px solid #e1e9df; border-left: 1px solid #e1e9df; border-radius: 0; padding: 8px 3px; background: #fff; font: 700 13px 'DM Sans', sans-serif; text-align: center; appearance: textfield; }
	.quantity-control input::-webkit-inner-spin-button, .quantity-control input::-webkit-outer-spin-button { appearance: none; margin: 0; }
	.purchase-actions { display: flex; gap: 8px; flex-wrap: wrap; }
	.purchase-actions button { min-height: 44px; border-radius: 7px; padding: 12px 15px; font: 700 12px 'DM Sans', sans-serif; cursor: pointer; }
	.purchase-actions button:disabled { opacity: .6; cursor: not-allowed; }
	.cart-action { border: 1px solid #39754b; background: #fff; color: #39754b; }
	.buy-now-action { border: 1px solid #39754b; background: #39754b; color: #fff; }
	.notice, .state { margin-top: 18px; border-radius: 7px; padding: 13px; background: #edf8ed; color: #39754b; font-size: 13px; }
	.notice a { color: #39754b; font-weight: 800; }
	.notice.error, .state.error { background: #fff0ef; color: #a44242; }
	.state { border: 1px solid #d6e1d5; background: #fff; text-align: center; }
	.shop-strip { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 22px; border-top: 1px solid #d6e1d5; border-bottom: 1px solid #d6e1d5; padding: 24px 4px; }
	.shop-strip h2, .section-heading h2 { margin: 0; font: 600 28px / 1.1 'Fraunces', Georgia, serif; }
	.shop-strip p:not(.eyebrow) { margin: 8px 0 0; color: #718077; font-size: 13px; }
	.shop-link, .section-heading a { color: #39754b; font-size: 13px; font-weight: 800; text-decoration: none; }
	.shop-link span { font-size: 18px; }
	.more-products { padding-top: 42px; }
	.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
	.related-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
	.detail-dropdown {
		margin-top: 18px;
		border: 1px solid #d6e1d5;
		border-radius: 9px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e08;
	}
	.detail-dropdown summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		cursor: pointer;
		list-style: none;
		padding: 18px 20px;
		color: #183126;
		font-size: 14px;
		font-weight: 800;
	}
	.detail-dropdown summary::-webkit-details-marker {
		display: none;
	}
	.detail-dropdown summary::after {
		content: '+';
		color: #39754b;
		font-size: 20px;
	}
	.detail-dropdown[open] summary::after {
		content: '−';
	}
	.detail-dropdown summary > span {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.detail-dropdown summary small {
		color: #718077;
		font-size: 11px;
		font-weight: 400;
		text-align: right;
	}
	.detail-dropdown > p,
	.description-dropdown > p {
		margin: 0;
		border-top: 1px solid #e8eee6;
		padding: 18px 20px 22px;
		color: #53665a;
		font-size: 14px;
		line-height: 1.75;
	}
	.source-logo {
		display: inline-flex;
		align-items: center;
		border-radius: 5px;
		background: #1769aa;
		color: #fff;
		padding: 5px 8px;
		font: 800 10px Arial, sans-serif;
		letter-spacing: .06em;
	}
	.weather-tabs {
		display: flex;
		gap: 6px;
		border-top: 1px solid #e8eee6;
		padding: 16px 20px 0;
	}
	.weather-tabs button {
		border: 1px solid #d6e1d5;
		border-radius: 6px;
		background: #f7faf6;
		color: #52705a;
		padding: 8px 9px;
		font-size: 11px;
		cursor: pointer;
	}
	.weather-tabs button.active {
		border-color: #39754b;
		background: #39754b;
		color: #fff;
	}
	.weather-tabs button:disabled {
		cursor: not-allowed;
		opacity: .45;
	}
	.weather-list {
		display: grid;
		gap: 9px;
		padding: 12px 20px 0;
	}
	.weather-row {
		display: grid;
		grid-template-columns: 1.2fr .8fr;
		gap: 7px 12px;
		border: 1px solid #e5ede3;
		border-radius: 7px;
		background: #f9fbf8;
		padding: 11px;
	}
	.weather-row strong,
	.weather-row span {
		display: block;
	}
	.weather-row strong {
		color: #274a32;
		font-size: 13px;
	}
	.weather-row span {
		margin-top: 4px;
		color: #718077;
		font-size: 11px;
	}
	.weather-main {
		text-align: right;
	}
	.weather-meta {
		display: flex;
		grid-column: 1 / -1;
		gap: 14px;
		border-top: 1px solid #e8eee6;
		padding-top: 7px;
	}
	.source-footer {
		margin: 16px 20px 18px;
		color: #829087;
		font-size: 10px;
		line-height: 1.5;
	}
	.recommendation-title {
		margin: 24px 0 12px;
		color: #274a32;
		font-size: 18px;
	}

	@media (max-width: 800px) {
		.product-detail { grid-template-columns: 1fr; gap: 28px; }
		.related-grid { grid-template-columns: repeat(2, 1fr); }
	}

	@media (max-width: 520px) {
		.page-shell { padding: 24px 14px 60px; }
		.product-detail { padding: 16px; }
		.visual { min-height: 290px; }
		.shop-strip, .section-heading { align-items: start; flex-direction: column; }
		.related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
	}
</style>