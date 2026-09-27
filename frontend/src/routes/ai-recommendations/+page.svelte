<script lang="ts">
	import { onMount } from 'svelte';
	import { getMyFarmlandRecommendations, type AiRecommendation } from '$lib/api/ai-api';
	import { getProvinceCodeFromRegionCode, getProvinces } from '$lib/api/wilayah-api';
	import Pagination from '$lib/components/Pagination.svelte';

	type RecommendationCard = AiRecommendation & { provinceName: string };
	const pageSize = 12;
	let recommendations = $state<RecommendationCard[]>([]);
	let page = $state(1);
	let totalPages = $state(1);
	let total = $state(0);
	let isLoading = $state(true);
	let errorMessage = $state('');

	onMount(() => { void loadRecommendations(1); });

	async function loadRecommendations(requestedPage: number) {
		isLoading = true;
		errorMessage = '';
		try {
			const result = await getMyFarmlandRecommendations(requestedPage, pageSize);
			const provinces = await getProvinces().catch(() => []);
			recommendations = result.data.map((recommendation) => {
				const provinceCode = getProvinceCodeFromRegionCode(recommendation.farmland?.adm4_code);
				return {
					...recommendation,
					provinceName: provinces.find((province) => province.code === provinceCode)?.name || (provinceCode ? `Provinsi ${provinceCode}` : 'Wilayah belum tersedia'),
				};
			});
			page = result.meta.page;
			totalPages = result.meta.totalPages;
			total = result.meta.total;
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat rekomendasi AI.';
		} finally {
			isLoading = false;
		}
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Rekomendasi AI | Tani Siaga</title>
	<meta name="description" content="Rekomendasi aksi perawatan tanaman berdasarkan kondisi lahan dan cuaca." />
</svelte:head>

<main class="recommendation-page">
	<a class="back-link" href="/dashboard">← Dashboard</a>
	<header class="page-heading">
		<div>
			<p class="eyebrow">PENDAMPING LAHAN · GEMINI</p>
			<h1>Rekomendasi AI</h1>
			<p class="subtitle">Langkah perawatan tanaman berdasarkan komoditas, lokasi, dan kondisi lahanmu.</p>
		</div>
		{#if !isLoading && !errorMessage}<span class="total-count">{total} rekomendasi</span>{/if}
	</header>

	{#if errorMessage}
		<div class="state error" role="alert"><p>{errorMessage}</p><button type="button" onclick={() => void loadRecommendations(page)}>Coba lagi</button></div>
	{:else if isLoading}
		<div class="state">Memuat rekomendasi AI...</div>
	{:else if recommendations.length === 0}
		<div class="state empty"><strong>Belum ada rekomendasi AI.</strong><p>Rekomendasi akan muncul setelah lahan aktif memiliki data cuaca dan komoditas.</p><a href="/lahan-tani">Lihat lahan tani →</a></div>
	{:else}
		<section class="recommendation-grid" aria-label="Rekomendasi AI per lahan">
			{#each recommendations as item (item.id)}
				<a class="recommendation-card" href={`/ai-recommendations/${item.id}`}>
					<div class="card-topline"><span class="source-mark">AI</span><time>{formatDate(item.created_at)}</time></div>
					<div class="card-title"><p class="eyebrow">AKSI DISARANKAN</p><span class="action-badge">{item.action_type}</span></div>
					<h2>{item.summary}</h2>
					<div class="context-grid">
						<div><span>Lahan</span><strong>{item.farmland?.name || 'Informasi lahan tidak tersedia'}</strong></div>
						<div><span>Komoditas</span><strong>{item.farmland?.commodity?.name || 'Belum ditentukan'}</strong></div>
						<div><span>Provinsi</span><strong>{item.provinceName}</strong></div>
					</div>
					<p class="summary">{item.detailed_advice}</p>
					{#if item.step_by_step_steps?.[0]}<p class="first-step"><strong>Langkah pertama</strong>{item.step_by_step_steps[0]}</p>{/if}
					<span class="detail-link">Buka rekomendasi <span aria-hidden="true">↗</span></span>
				</a>
			{/each}
		</section>
		<Pagination {page} {totalPages} onPageChange={(nextPage) => void loadRecommendations(nextPage)} disabled={isLoading} />
	{/if}
</main>

<style>
	.recommendation-page { width: min(100% - 56px, 1100px); margin: 0 auto; padding: 38px 0 80px; color: #183126; }
	.back-link { display: inline-block; margin-bottom: 28px; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
	.eyebrow { margin: 0 0 9px; color: #4e805a; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
	h1 { margin: 0; font: 600 52px/1 'Fraunces', Georgia, serif; }
	.subtitle { max-width: 650px; margin: 12px 0 0; color: #718077; font-size: 14px; line-height: 1.6; }
	.total-count { color: #718077; font-size: 12px; white-space: nowrap; }
	.recommendation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.recommendation-card { display: grid; gap: 13px; min-width: 0; border: 1px solid #d6e1d5; border-radius: 9px; background: #fff; padding: 20px; color: inherit; text-decoration: none; transition: border-color .18s, transform .18s, box-shadow .18s; }
	.recommendation-card:hover { transform: translateY(-2px); border-color: #77a87b; box-shadow: 0 10px 24px #23472e10; }
	.card-topline, .card-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
	.source-mark { display: inline-grid; place-items: center; min-width: 36px; height: 26px; border-radius: 4px; background: #39754b; color: #fff; font: 800 10px Arial,sans-serif; }
	time { color: #829087; font-size: 10px; }
	.card-title .eyebrow { margin: 0; }
	.action-badge { border-radius: 4px; background: #fff4dc; color: #875c22; padding: 6px 8px; font-size: 9px; font-weight: 800; }
	h2 { margin: 0; font: 600 25px/1.15 'Fraunces', Georgia, serif; overflow-wrap: anywhere; }
	.context-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
	.context-grid > div { display: grid; gap: 4px; min-width: 0; border-left: 2px solid #77a87b; background: #f4f8f2; padding: 8px 10px; }
	.context-grid > div:first-child { grid-column: 1 / -1; }
	.context-grid span { color: #718077; font-size: 9px; }
	.context-grid strong { color: #274a32; font-size: 11px; overflow-wrap: anywhere; }
	.summary { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; margin: 0; color: #53665a; font-size: 12px; line-height: 1.6; }
	.first-step { display: grid; gap: 4px; margin: 0; border-top: 1px solid #e8eee6; padding-top: 11px; color: #385540; font-size: 11px; line-height: 1.5; }
	.first-step strong { color: #718077; font-size: 9px; text-transform: uppercase; }
	.detail-link { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 5px; color: #39754b; font-size: 11px; font-weight: 800; }
	.state { border: 1px solid #d6e1d5; border-radius: 8px; background: #fff; padding: 42px 20px; color: #718077; text-align: center; }
	.state p { margin: 8px 0 0; font-size: 13px; }
	.state a { display: inline-block; margin-top: 14px; color: #39754b; font-size: 12px; font-weight: 800; text-decoration: none; }
	.state.error { border-color: #e6b8b3; background: #fff0ef; color: #a44242; }
	.state button { margin-top: 14px; border: 1px solid #a44242; border-radius: 6px; background: #fff; color: #a44242; padding: 9px 12px; font: inherit; font-size: 12px; cursor: pointer; }
	@media (max-width: 700px) { .recommendation-page { width: min(100% - 32px, 1100px); padding-top: 24px; }.back-link { margin-bottom: 20px; }.page-heading { align-items: flex-start; flex-direction: column; gap: 9px; margin-bottom: 22px; } h1 { font-size: 32px; line-height: 1.08; }.subtitle { margin-top: 9px; font-size: 13px; }.recommendation-grid { grid-template-columns: 1fr; gap: 12px; }.recommendation-card { gap: 11px; padding: 14px; } h2 { font-size: 21px; }.context-grid { gap: 6px; }.context-grid > div { padding: 7px 9px; }.summary { font-size: 11px; }.first-step { font-size: 10px; } }
</style>