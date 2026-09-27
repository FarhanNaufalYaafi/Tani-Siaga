<script lang="ts">
	import { onMount } from 'svelte';
	import { getMyFarmlandMarketAnalyses, type MarketAnalysis } from '$lib/api/ai-api';
	import Pagination from '$lib/components/Pagination.svelte';

	const pageSize = 12;
	let analyses = $state<MarketAnalysis[]>([]);
	let page = $state(1);
	let totalPages = $state(1);
	let total = $state(0);
	let isLoading = $state(true);
	let errorMessage = $state('');

	onMount(() => { void loadAnalyses(1); });

	async function loadAnalyses(requestedPage: number) {
		isLoading = true;
		errorMessage = '';
		try {
			const result = await getMyFarmlandMarketAnalyses(requestedPage, pageSize);
			analyses = result.data;
			page = result.meta.page;
			totalPages = result.meta.totalPages;
			total = result.meta.total;
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat analisis pasar lahan.';
		} finally {
			isLoading = false;
		}
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
	}

	function surplus(value: number) {
		return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`;
	}
</script>

<svelte:head>
	<title>Analisis Pasar Lahan | Tani Siaga</title>
	<meta name="description" content="Analisis pasar komoditas dari data BPS dan Tani Siaga untuk lahanmu." />
</svelte:head>

<main class="market-page">
	<a class="back-link" href="/dashboard">← Dashboard</a>
	<header class="page-heading">
		<div>
			<p class="eyebrow">BPS + DATA TANI SIAGA</p>
			<h1>Analisis Pasar</h1>
			<p class="subtitle">Prospek komoditas berdasarkan wilayah dan lahan yang terhubung dengan akunmu.</p>
		</div>
		{#if !isLoading && !errorMessage}<span class="total-count">{total} analisis</span>{/if}
	</header>

	{#if errorMessage}
		<div class="state error" role="alert"><p>{errorMessage}</p><button type="button" onclick={() => void loadAnalyses(page)}>Coba lagi</button></div>
	{:else if isLoading}
		<div class="state">Memuat analisis pasar...</div>
	{:else if analyses.length === 0}
		<div class="state empty"><strong>Belum ada analisis pasar untuk lahanmu.</strong><p>Analisis akan muncul setelah lahan dan komoditas aktif tersedia.</p><a href="/lahan-tani">Lihat lahan tani →</a></div>
	{:else}
		<section class="analysis-grid" aria-label="Daftar analisis pasar">
			{#each analyses as analysis (analysis.id)}
				<a class="analysis-card" href={`/market-analysis/${analysis.id}`}>
					<div class="card-topline"><span class="source-mark">BPS</span><time>{formatDate(analysis.created_at)}</time></div>
					<p class="eyebrow">PROSPEK KOMODITAS</p>
					<h2>{analysis.commodity_name}</h2>
					<div class="metrics">
						<div><span>Tren harga</span><strong class:up={analysis.price_trend === 'NAIK'} class:down={analysis.price_trend === 'TURUN'}>{analysis.price_trend}</strong></div>
						<div><span>Surplus wilayah</span><strong>{surplus(analysis.surplus_percentage)}</strong></div>
					</div>
					<p class="summary">{analysis.prediction_meta?.simple_summary_for_farmers || analysis.analysis_summary}</p>
					<div class="farmland-list"><span>Lahan terkait</span><div>{#each analysis.related_farmlands || [] as farmland (farmland.id)}<span class="farmland-chip">{farmland.name}</span>{/each}</div></div>
					<span class="detail-link">Buka analisis <span aria-hidden="true">↗</span></span>
				</a>
			{/each}
		</section>
		<Pagination {page} {totalPages} onPageChange={(nextPage) => void loadAnalyses(nextPage)} disabled={isLoading} />
	{/if}
</main>

<style>
	.market-page { width: min(100% - 56px, 1100px); margin: 0 auto; padding: 38px 0 80px; color: #183126; }
	.back-link { display: inline-block; margin-bottom: 28px; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
	.eyebrow { margin: 0 0 9px; color: #4e805a; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
	h1 { margin: 0; font: 600 52px/1 'Fraunces', Georgia, serif; }
	.subtitle { max-width: 650px; margin: 12px 0 0; color: #718077; font-size: 14px; line-height: 1.6; }
	.total-count { color: #718077; font-size: 12px; white-space: nowrap; }
	.analysis-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.analysis-card { display: grid; gap: 14px; min-width: 0; border: 1px solid #d6e1d5; border-radius: 9px; background: #fff; padding: 20px; color: inherit; text-decoration: none; transition: border-color .18s, transform .18s, box-shadow .18s; }
	.analysis-card:hover { transform: translateY(-2px); border-color: #77a87b; box-shadow: 0 10px 24px #23472e10; }
	.card-topline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
	.source-mark { display: inline-grid; place-items: center; min-width: 36px; height: 26px; border-radius: 4px; background: #1b4d8f; color: #fff; font: 800 10px Arial,sans-serif; }
	time { color: #829087; font-size: 10px; }
	.analysis-card .eyebrow { margin-bottom: -8px; }
	h2 { margin: 0; font: 600 27px/1.1 'Fraunces', Georgia, serif; overflow-wrap: anywhere; }
	.metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
	.metrics > div { display: grid; gap: 5px; border-radius: 6px; background: #f4f8f2; padding: 12px; }
	.metrics span { color: #718077; font-size: 10px; }
	.metrics strong { color: #39754b; font-size: 17px; }
	.metrics strong.up { color: #a44242; }
	.metrics strong.down { color: #39754b; }
	.summary { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; margin: 0; color: #53665a; font-size: 12px; line-height: 1.6; }
	.farmland-list { display: grid; gap: 7px; padding-top: 12px; border-top: 1px solid #e8eee6; }
	.farmland-list > span { color: #718077; font-size: 10px; font-weight: 700; }
	.farmland-list > div { display: flex; flex-wrap: wrap; gap: 6px; }
	.farmland-chip { border-radius: 999px; background: #eaf4e9; color: #39754b; padding: 5px 8px; font-size: 10px; }
	.detail-link { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 8px; color: #39754b; font-size: 11px; font-weight: 800; }
	.state { border: 1px solid #d6e1d5; border-radius: 8px; background: #fff; padding: 42px 20px; color: #718077; text-align: center; }
	.state p { margin: 8px 0 0; font-size: 13px; }
	.state a { display: inline-block; margin-top: 14px; color: #39754b; font-size: 12px; font-weight: 800; text-decoration: none; }
	.state.error { border-color: #e6b8b3; background: #fff0ef; color: #a44242; }
	.state button { margin-top: 14px; border: 1px solid #a44242; border-radius: 6px; background: #fff; color: #a44242; padding: 9px 12px; font: inherit; font-size: 12px; cursor: pointer; }
	@media (max-width: 700px) { .market-page { width: min(100% - 32px, 1100px); padding-top: 24px; }.back-link { margin-bottom: 20px; }.page-heading { align-items: flex-start; flex-direction: column; gap: 9px; margin-bottom: 22px; } h1 { font-size: 32px; line-height: 1.08; }.subtitle { margin-top: 9px; font-size: 13px; }.analysis-grid { grid-template-columns: 1fr; gap: 12px; }.analysis-card { gap: 11px; padding: 14px; } h2 { font-size: 22px; }.metrics { gap: 7px; }.metrics > div { padding: 10px; }.metrics strong { font-size: 16px; }.summary { font-size: 11px; }.farmland-list { padding-top: 10px; } }
</style>
