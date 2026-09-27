<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { getProducts, type ProductCatalog } from '$lib/api/product-api';
	import Card from '$lib/components/Card.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	const PAGE_SIZE = 24;
	let catalog = $state<ProductCatalog>({ data: [], meta: { page: 1, limit: PAGE_SIZE, total: 0, total_pages: 1 } });
	let category = $state<'all' | 'pre_order' | 'ready_stock'>('all');
	let search = $state('');
	let isLoading = $state(true);
	let errorMessage = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => { void loadProducts(); });
	onDestroy(() => { if (searchTimer) clearTimeout(searchTimer); });

	async function loadProducts(page = 1) {
		isLoading = true;
		errorMessage = '';
		try { catalog = await getProducts(category, page, PAGE_SIZE, search.trim()); }
		catch (error: any) { errorMessage = error.message || 'Gagal memuat katalog produk.'; }
		finally { isLoading = false; }
	}

	function changeCategory(value: 'all' | 'pre_order' | 'ready_stock') {
		if (searchTimer) clearTimeout(searchTimer);
		category = value;
		void loadProducts(1);
	}

	function handleSearch() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => void loadProducts(1), 300);
	}
</script>

<svelte:head><title>E-Commerce | Tani Siaga</title></svelte:head>

<div class="shop-shell">
	<header class="shop-header">
		<a class="back" href="/dashboard">← Dashboard</a>
		<div><p class="eyebrow">PASAR TANI SIAGA</p><h1>Hasil terbaik dari lahan lokal.</h1><p class="subtitle">Belanja hasil panen siap kirim atau pesan lebih awal langsung dari toko petani.</p></div>
		<div class="header-actions">
			<a class="cart-link" href="/keranjang">🛒 Keranjang</a>
			<a class="preorders-link" href="/pre-order">Pre-order saya</a>
		</div>
	</header>

	<main class="shop-main">
		<div class="category-tabs">
			<button class:active={category === 'all'} onclick={() => changeCategory('all')}>Semua produk</button>
			<button class:active={category === 'pre_order'} onclick={() => changeCategory('pre_order')}>Pre-order hasil panen</button>
			<button class:active={category === 'ready_stock'} onclick={() => changeCategory('ready_stock')}>Produk panen</button>
		</div>
		<label class="search-field">
			<span aria-hidden="true">⌕</span>
			<input type="search" bind:value={search} oninput={handleSearch} placeholder={`Cari ${category === 'all' ? 'semua produk' : category === 'pre_order' ? 'produk pre-order' : 'produk siap kirim'}...`} aria-label="Cari produk pada kategori aktif" />
		</label>
		{#if errorMessage}<div class="notice error">{errorMessage}<button onclick={() => loadProducts(catalog.meta.page)}>Coba lagi</button></div>{/if}
		{#if isLoading}
			<div class="product-grid">{#each Array(8) as _}<div class="skeleton"></div>{/each}</div>
		{:else if catalog.data.length === 0}
			<div class="empty">{search.trim() ? `Tidak ada produk yang cocok dengan “${search.trim()}” pada kategori ini.` : 'Belum ada produk pada kategori ini.'}</div>
		{:else}
			<div class="product-grid">{#each catalog.data as product (product.id)}<Card {product} />{/each}</div>
		{/if}
		<Pagination page={catalog.meta.page} totalPages={catalog.meta.total_pages} onPageChange={(nextPage) => void loadProducts(nextPage)} disabled={isLoading} />
	</main>
</div>

<style>
	.shop-shell { min-height: 100vh; background: #f5f7f0; color: #183126; }
	.shop-header { display: grid; grid-template-columns: 150px 1fr auto; align-items: end; gap: 25px; max-width: 1180px; margin: auto; padding: 42px 28px 44px; }
	.back { align-self: start; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.eyebrow { margin: 0 0 10px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
	.shop-header h1 { max-width: 700px; margin: 0; font: 600 clamp(38px, 5vw, 67px) / 1 'Fraunces', Georgia, serif; }
	.subtitle { max-width: 620px; margin: 16px 0 0; color: #718077; line-height: 1.55; }
	.cart-link { border-radius: 7px; background: #183126; color: #fff; padding: 12px 15px; font-size: 12px; font-weight: 700; text-decoration: none; }
	.header-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 9px; }
	.preorders-link { border: 1px solid #a9c9aa; border-radius: 7px; background: #fff; color: #39754b; padding: 11px 13px; font-size: 12px; font-weight: 700; text-decoration: none; }
	.shop-main { max-width: 1180px; margin: auto; padding: 0 28px 70px; }
	.category-tabs { display: flex; gap: 8px; overflow-x: auto; border-bottom: 1px solid #d6e1d5; margin-bottom: 24px; padding-bottom: 13px; }
	.category-tabs button { border: 1px solid #d6e1d5; border-radius: 999px; background: #fff; color: #52705a; padding: 11px 15px; font: 700 12px 'DM Sans', sans-serif; white-space: nowrap; cursor: pointer; }
	.category-tabs button.active { border-color: #39754b; background: #39754b; color: #fff; }
	.search-field { display: flex; align-items: center; gap: 10px; width: min(100%, 520px); min-height: 44px; margin: 0 0 20px; border: 1px solid #cbdacb; border-radius: 8px; background: #fff; padding: 0 12px; color: #39754b; }
	.search-field:focus-within { border-color: #39754b; box-shadow: 0 0 0 3px #39754b1c; }
	.search-field span { font-size: 20px; line-height: 1; }
	.search-field input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #183126; font: inherit; font-size: 13px; }
	.search-field input::placeholder { color: #829087; }
	.product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 17px; }
	.notice, .empty { margin-bottom: 18px; border: 1px solid #d6e1d5; border-radius: 8px; background: #fff; color: #718077; padding: 14px; font-size: 13px; }
	.notice.error { display: flex; justify-content: space-between; gap: 12px; background: #fff0ef; color: #a44242; }
	.notice button { border: 0; background: transparent; color: #a44242; text-decoration: underline; cursor: pointer; }
	.skeleton { min-height: 370px; border-radius: 10px; background: linear-gradient(100deg, #e6eee3 30%, #f6f9f4 45%, #e6eee3 60%); background-size: 200% 100%; animation: loading 1.3s infinite; }
	@keyframes loading { to { background-position: -200% 0; } }
	@media (max-width: 950px) { .product-grid { grid-template-columns: repeat(3, 1fr); } }
	@media (max-width: 720px) { .shop-header { display: block; padding: 28px 18px 34px; } .header-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; margin-top: 18px; gap: 10px; } .header-actions a { display: flex; min-height: 44px; align-items: center; justify-content: center; box-sizing: border-box; margin: 0; padding: 10px 8px; text-align: center; white-space: nowrap; } .shop-main { padding: 0 18px 50px; } .product-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
	@media (max-width: 480px) { .shop-main { padding-right: 14px; padding-left: 14px; }.product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }.skeleton { min-height: 250px; } }
</style>