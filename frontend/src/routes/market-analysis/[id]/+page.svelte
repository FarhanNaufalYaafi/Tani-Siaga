<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getMarketAnalysisDetail, type MarketAnalysis } from '$lib/api/ai-api';
	import { getProvinceCodeFromRegionCode, getProvinces } from '$lib/api/wilayah-api';

	let analysis = $state<MarketAnalysis | null>(null);
	let provinceName = $state('');
	let isLoading = $state(true);
	let errorMessage = $state('');

	onMount(() => { void loadAnalysis(); });

	async function loadAnalysis() {
		const id = page.params.id;
		if (!id) {
			errorMessage = 'ID analisis tidak ditemukan.';
			isLoading = false;
			return;
		}
		try {
			analysis = await getMarketAnalysisDetail(id);
			const provinces = await getProvinces().catch(() => []);
			const provinceCode = getProvinceCodeFromRegionCode(analysis.province_code);
			provinceName = provinces.find((province) => province.code === provinceCode)?.name || `Provinsi ${provinceCode}`;
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat detail analisis pasar.';
		} finally {
			isLoading = false;
		}
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
	}

	function surplus(value: number) {
		return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`;
	}
</script>

<svelte:head>
	<title>{analysis ? `${analysis.commodity_name} | Analisis Pasar` : 'Detail Analisis Pasar'}</title>
</svelte:head>

<main class="detail-page">
	<a class="back-link" href="/market-analysis">← Kembali ke Analisis Pasar</a>
	{#if isLoading}
		<div class="state">Memuat detail analisis...</div>
	{:else if errorMessage}
		<div class="state error" role="alert"><p>{errorMessage}</p><a href="/market-analysis">Kembali ke daftar analisis</a></div>
	{:else if analysis}
		<article class="analysis-detail">
			<header class="detail-header">
				<div><p class="eyebrow">MARKET INTELLIGENCE · BPS + TANI SIAGA</p><h1>{analysis.commodity_name}</h1><p class="detail-subtitle">Prospek komoditas untuk lahanmu di {provinceName}.</p></div>
				<time>{formatDate(analysis.created_at)}</time>
			</header>

			<section class="context-grid" aria-label="Konteks analisis">
				<div class="context-item land-context"><span>LAHAN TERKAIT</span><div>{#each analysis.related_farmlands || [] as farmland (farmland.id)}<a href={`/lahan-tani/${farmland.id}`}>{farmland.name}<span aria-hidden="true">↗</span></a>{:else}<strong>Belum ada lahan terkait</strong>{/each}</div></div>
				<div class="context-item"><span>KOMODITAS</span><strong>{analysis.commodity_name}</strong></div>
				<div class="context-item"><span>PROVINSI</span><strong>{provinceName || `Provinsi ${analysis.province_code}`}</strong></div>
			</section>

			<section class="market-metrics" aria-label="Ringkasan pasar">
				<div class="metric trend"><span>Tren harga</span><strong>{analysis.price_trend}</strong></div>
				<div class="metric"><span>Surplus wilayah</span><strong>{surplus(analysis.surplus_percentage)}</strong></div>
				{#if analysis.prediction_meta?.next_month_surplus_percentage != null}
					<div class="metric"><span>Proyeksi surplus bulan depan</span><strong>{surplus(analysis.prediction_meta.next_month_surplus_percentage)}</strong></div>
				{/if}
			</section>

			{#if analysis.prediction_meta?.simple_summary_for_farmers}
				<section class="farmer-summary"><p class="eyebrow">KESIMPULAN UNTUK PETANI</p><p>{analysis.prediction_meta.simple_summary_for_farmers}</p></section>
			{/if}

			<section class="analysis-section"><p class="eyebrow">ANALISIS PASAR</p><h2>Prospek {analysis.commodity_name}</h2><p>{analysis.analysis_summary}</p></section>

			{#if analysis.prediction_meta?.price_forecast_reason}
				<section class="analysis-section secondary"><p class="eyebrow">ALASAN PROYEKSI HARGA</p><p>{analysis.prediction_meta.price_forecast_reason}</p></section>
			{/if}

			{#if analysis.prediction_meta?.historical_analogy_context}
				<section class="analysis-section secondary"><p class="eyebrow">KONTEKS HISTORIS</p><p>{analysis.prediction_meta.historical_analogy_context}</p></section>
			{/if}
		</article>
	{/if}
</main>

<style>
	.detail-page { width: min(100% - 56px, 920px); margin: 0 auto; padding: 38px 0 80px; color: #183126; }
	.back-link { display: inline-block; margin-bottom: 22px; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.analysis-detail { overflow: hidden; border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; box-shadow: 0 8px 24px #23472e0a; }
	.detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 30px; border-bottom: 1px solid #e8eee6; }
	.eyebrow { margin: 0 0 9px; color: #4e805a; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
	h1 { margin: 0; font: 600 48px/1.05 'Fraunces', Georgia, serif; overflow-wrap: anywhere; }
	.detail-subtitle { margin: 10px 0 0; color: #718077; font-size: 13px; }
	time { flex-shrink: 0; color: #829087; font-size: 10px; }
	.context-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px; padding: 18px 30px; border-bottom: 1px solid #e8eee6; }
	.context-item { display: grid; align-content: start; gap: 7px; min-width: 0; border-left: 3px solid #77a87b; background: #f4f8f2; padding: 12px 14px; }
	.context-item > span { color: #718077; font-size: 9px; font-weight: 800; letter-spacing: .12em; }
	.context-item strong { color: #274a32; font-size: 14px; overflow-wrap: anywhere; }
	.land-context > div { display: grid; gap: 6px; }
	.land-context a { display: flex; justify-content: space-between; gap: 8px; color: #39754b; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; text-decoration: none; }
	.land-context a + a { border-top: 1px solid #dfe8dd; padding-top: 6px; }
	.land-context a:hover { color: #274a32; }
	.market-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; padding: 22px 30px; }
	.metric { display: grid; gap: 7px; border-radius: 7px; background: #f4f8f2; padding: 16px; }
	.metric span { color: #718077; font-size: 11px; }
	.metric strong { color: #39754b; font-size: 21px; }
	.metric.trend strong { color: #9a6921; }
	.farmer-summary { margin: 0 30px 22px; border-left: 4px solid #39754b; background: #edf8ed; padding: 17px 20px; }
	.farmer-summary .eyebrow { margin-bottom: 8px; }
	.farmer-summary > p:last-child { margin: 0; color: #274a32; font: 600 18px/1.5 'Fraunces', Georgia, serif; }
	.analysis-section { padding: 22px 30px; border-top: 1px solid #e8eee6; }
	.analysis-section h2 { margin: 0 0 10px; font: 600 25px/1.2 'Fraunces', Georgia, serif; }
	.analysis-section > p:last-child { margin: 0; color: #53665a; font-size: 14px; line-height: 1.75; white-space: pre-line; }
	.analysis-section.secondary { background: #fbfcfa; }
	.state { border: 1px solid #d6e1d5; border-radius: 9px; background: #fff; padding: 42px 20px; color: #718077; text-align: center; }
	.state.error { border-color: #e6b8b3; background: #fff0ef; color: #a44242; }
	.state p { margin: 0; }
	.state a { display: inline-block; margin-top: 12px; color: #39754b; font-size: 12px; font-weight: 800; text-decoration: none; }
	@media (max-width: 600px) {
		.detail-page { width: min(100% - 28px, 920px); padding: 26px 0 60px; }
		.detail-header { flex-direction: column; gap: 12px; padding: 22px; }
		h1 { font-size: 30px; }
		.context-grid { grid-template-columns: 1fr; gap: 8px; padding: 14px 18px; }
		.context-item { padding: 10px 12px; }
		.context-item strong, .land-context a { font-size: 13px; }
		.market-metrics { grid-template-columns: 1fr 1fr; gap: 8px; padding: 16px 18px; }
		.metric { padding: 12px; }
		.metric strong { font-size: 18px; }
		.farmer-summary { margin: 0 18px 16px; padding: 14px 16px; }
		.farmer-summary > p:last-child { font-size: 16px; }
		.analysis-section { padding: 18px; }
		.analysis-section h2 { font-size: 21px; }
		.analysis-section > p:last-child { font-size: 13px; }
	}
</style>
