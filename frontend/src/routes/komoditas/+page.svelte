<script lang="ts">
	import { onMount } from 'svelte';
	import { getCommoditiesPage, type Commodity } from '$lib/api/commodity-api';
	import type { PaginationMeta } from '$lib/api/pagination';
	import Pagination from '$lib/components/Pagination.svelte';

	let commodities = $state<Commodity[]>([]);
	let search = $state('');
	let page = $state(1);
	const pageSize = 8;
	let pagination = $state<PaginationMeta>({ page: 1, limit: pageSize, total: 0, total_pages: 1 });
	let isLoading = $state(true);
	let errorMessage = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => { void loadCommodities(1); });

	async function loadCommodities(requestedPage = page) {
		isLoading = true;
		errorMessage = '';
		try {
			const result = await getCommoditiesPage(requestedPage, pageSize, search);
			commodities = result.data;
			pagination = result.meta;
			page = result.meta.page;
		} catch (error: any) { errorMessage = error.message || 'Gagal memuat katalog komoditas.'; }
		finally { isLoading = false; }
	}

	function handleSearch() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => { page = 1; void loadCommodities(1); }, 300);
	}

	function changePage(nextPage: number) { page = nextPage; void loadCommodities(nextPage); }
</script>

<svelte:head><title>Komoditas | Tani Siaga</title></svelte:head>

<div class="page-shell"><div class="page-container">
	<a class="back-link" href="/dashboard">← Kembali ke Dashboard</a>
	<div class="heading"><div><p class="eyebrow">KATALOG PERTANIAN</p><h1>Komoditas</h1><p class="subtitle">Lihat parameter tanaman yang dipakai untuk rekomendasi dan analisis lahan.</p></div><a class="primary" href="/komoditas/create">+ Buat komoditas</a></div>
	{#if errorMessage}<div class="alert error">{errorMessage}</div>{/if}
	<div class="toolbar"><input bind:value={search} oninput={handleSearch} placeholder="Cari nama atau varietas..." aria-label="Cari komoditas" /><span>{pagination.total} komoditas</span></div>
	{#if isLoading}<div class="state">Memuat katalog komoditas...</div>
	{:else if commodities.length === 0}<div class="state">Komoditas belum ditemukan.</div>
	{:else}<div class="grid">{#each commodities as commodity (commodity.id)}<a class="commodity-card" href={`/komoditas/${commodity.id}`}><div class="crop-icon">🌱</div><div><h2>{commodity.name}</h2><p>{commodity.variety || 'Varietas umum'}</p></div><div class="metrics"><span>Panen<strong>{commodity.avg_harvest_days} hari</strong></span><span>Suhu<strong>{commodity.min_temp_celsius}–{commodity.max_temp_celsius}°C</strong></span><span>Kelembapan<strong>≤ {commodity.max_humidity_percentage}%</strong></span></div><span class="arrow">→</span></a>{/each}</div><Pagination page={page} totalPages={pagination.total_pages} onPageChange={changePage} disabled={isLoading}/>{/if}
</div></div>

<style>
	.page-shell{min-height:100vh;background:#f4f7f1;color:#183126;padding:36px 20px 68px}.page-container{max-width:1000px;margin:auto}.back-link{display:inline-block;margin-bottom:28px;color:#39754b;font-size:13px;font-weight:700;text-decoration:none}.heading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:28px}.eyebrow{margin:0 0 9px;color:#4e805a;font-size:11px;font-weight:800;letter-spacing:.14em}.heading h1{margin:0;font-size:clamp(38px,6vw,56px);line-height:1.02}.subtitle{max-width:580px;margin:14px 0 0;color:#718077;line-height:1.6}.primary{border-radius:7px;background:#39754b;color:#fff;padding:12px 16px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap}.toolbar{display:flex;align-items:center;gap:16px;margin-bottom:16px}.toolbar input{flex:1;border:1px solid #d6e1d5;border-radius:7px;background:#fff;padding:13px;font:inherit;outline:0}.toolbar input:focus{border-color:#39754b;box-shadow:0 0 0 3px #39754b1c}.toolbar span{color:#718077;font-size:13px;white-space:nowrap}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.commodity-card{position:relative;display:grid;grid-template-columns:44px 1fr;gap:4px 14px;padding:20px;border:1px solid #d6e1d5;border-radius:10px;background:#fff;color:#183126;text-decoration:none;box-shadow:0 8px 22px #23472e0a;transition:transform .18s,border-color .18s}.commodity-card:hover{transform:translateY(-2px);border-color:#77a87b}.crop-icon{grid-row:span 2;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:#eaf4e9;font-size:23px}.commodity-card h2{margin:0;font-size:20px}.commodity-card p{margin:4px 0 0;color:#718077;font-size:13px}.metrics{grid-column:1/-1;display:flex;gap:8px;margin-top:16px}.metrics span{flex:1;padding:10px;background:#f7faf6;color:#718077;font-size:10px}.metrics strong{display:block;margin-top:4px;color:#39754b;font-size:12px}.arrow{position:absolute;top:20px;right:20px;color:#39754b;font-size:18px}.alert,.state{padding:16px;border:1px solid #d6e1d5;border-radius:8px;background:#fff}.alert.error{color:#a44242;background:#fff0ef}.state{text-align:center;color:#718077}@media(max-width:700px){.heading{display:block}.primary{display:inline-block;margin-top:20px}.grid{grid-template-columns:1fr}.toolbar{align-items:stretch;flex-direction:column;gap:8px}.metrics{gap:4px}}
</style>
