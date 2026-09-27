<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getRecommendationDetail, type AiRecommendation } from '$lib/api/ai-api';
	import { getProvinceCodeFromRegionCode, getProvinces } from '$lib/api/wilayah-api';

	let recommendation = $state<AiRecommendation | null>(null);
	let provinceName = $state('');
	let isLoading = $state(true);
	let errorMessage = $state('');

	onMount(() => { void loadRecommendation(); });

	async function loadRecommendation() {
		const id = page.params.id;
		if (!id) { errorMessage = 'ID rekomendasi tidak ditemukan.'; isLoading = false; return; }
		isLoading = true;
		errorMessage = '';
		try {
			recommendation = await getRecommendationDetail(id);
			const provinceCode = getProvinceCodeFromRegionCode(recommendation.farmland?.adm4_code);
			const provinces = await getProvinces().catch(() => []);
			provinceName = provinces.find((province) => province.code === provinceCode)?.name || (provinceCode ? `Provinsi ${provinceCode}` : 'Wilayah belum tersedia');
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat detail rekomendasi AI.';
		} finally {
			isLoading = false;
		}
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
	}
</script>

<svelte:head>
	<title>{recommendation ? `${recommendation.farmland?.name || 'Lahan'} | Rekomendasi AI` : 'Detail Rekomendasi AI'}</title>
</svelte:head>

<main class="detail-page">
	<a class="back-link" href="/ai-recommendations">← Kembali ke Rekomendasi AI</a>
	{#if isLoading}
		<div class="state">Memuat detail rekomendasi...</div>
	{:else if errorMessage}
		<div class="state error" role="alert"><p>{errorMessage}</p><button type="button" onclick={() => void loadRecommendation()}>Coba lagi</button><a href="/ai-recommendations">Kembali ke daftar rekomendasi</a></div>
	{:else if recommendation}
		<article class="recommendation-detail">
			<header class="detail-header">
				<div><p class="eyebrow">PENDAMPING LAHAN · GEMINI</p><h1>{recommendation.summary}</h1><p class="detail-subtitle">Saran aksi untuk merawat komoditas berdasarkan kondisi lahan.</p></div>
			<div class="header-meta"><span class="action-badge">{recommendation.action_type}</span><time>{formatDate(recommendation.created_at)}</time></div>
			</header>

			<section class="context-grid" aria-label="Konteks rekomendasi">
				<div><span>LAHAN</span>{#if recommendation.farmland?.id}<a href={`/lahan-tani/${recommendation.farmland.id}`}>{recommendation.farmland.name}<span aria-hidden="true">↗</span></a>{:else}<strong>{recommendation.farmland?.name || 'Informasi lahan tidak tersedia'}</strong>{/if}</div>
				<div><span>KOMODITAS</span><strong>{recommendation.farmland?.commodity?.name || 'Belum ditentukan'}</strong></div>
				<div><span>PROVINSI</span><strong>{provinceName}</strong></div>
			</section>

			<section class="advice-section">
				<p class="eyebrow">RINGKASAN SARAN</p>
				<p>{recommendation.detailed_advice}</p>
			</section>

			<section class="steps-section">
				<p class="eyebrow">LANGKAH YANG DISARANKAN</p>
				{#if recommendation.step_by_step_steps?.length}<ol>{#each recommendation.step_by_step_steps as step, index}<li><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>{/each}</ol>{:else}<p class="muted">Belum ada langkah rinci untuk rekomendasi ini.</p>{/if}
			</section>
		</article>
	{/if}
</main>

<style>
	.detail-page { width: min(100% - 56px, 920px); margin: 0 auto; padding: 38px 0 80px; color: #183126; }
	.back-link { display: inline-block; margin-bottom: 22px; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.recommendation-detail { overflow: hidden; border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; box-shadow: 0 8px 24px #23472e0a; }
	.detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 30px; border-bottom: 1px solid #e8eee6; }
	.eyebrow { margin: 0 0 9px; color: #4e805a; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
	h1 { max-width: 680px; margin: 0; font: 600 40px/1.1 'Fraunces', Georgia, serif; overflow-wrap: anywhere; }
	.detail-subtitle { margin: 10px 0 0; color: #718077; font-size: 13px; }
	.header-meta { display: grid; justify-items: end; gap: 12px; flex: 0 0 auto; }
	time { color: #829087; font-size: 10px; }
	.action-badge { border-radius: 4px; background: #fff4dc; color: #875c22; padding: 7px 9px; font-size: 10px; font-weight: 800; }
	.context-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 10px; padding: 18px 30px; border-bottom: 1px solid #e8eee6; }
	.context-grid > div { display: grid; align-content: start; gap: 7px; min-width: 0; border-left: 3px solid #77a87b; background: #f4f8f2; padding: 12px 14px; }
	.context-grid > div > span { color: #718077; font-size: 9px; font-weight: 800; letter-spacing: .12em; }
	.context-grid strong, .context-grid a { color: #274a32; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
	.context-grid a { display: flex; justify-content: space-between; gap: 8px; color: #39754b; text-decoration: none; }
	.advice-section, .steps-section { padding: 24px 30px; }
	.advice-section { border-bottom: 1px solid #e8eee6; background: #f4faf2; }
	.advice-section > p:last-child { margin: 0; color: #274a32; font: 600 18px/1.55 'Fraunces', Georgia, serif; white-space: pre-line; }
	.steps-section ol { display: grid; gap: 9px; margin: 14px 0 0; padding: 0; list-style: none; }
	.steps-section li { display: grid; grid-template-columns: 34px 1fr; align-items: start; gap: 12px; border-bottom: 1px solid #e8eee6; padding: 12px 0; }
	.steps-section li > span { color: #39754b; font-size: 11px; font-weight: 800; }
	.steps-section li p { margin: 0; color: #53665a; font-size: 14px; line-height: 1.65; white-space: pre-line; }
	.muted { color: #718077; font-size: 13px; }
	.state { border: 1px solid #d6e1d5; border-radius: 9px; background: #fff; padding: 42px 20px; color: #718077; text-align: center; }
	.state.error { border-color: #e6b8b3; background: #fff0ef; color: #a44242; }
	.state p { margin: 0; }
	.state a { display: inline-block; margin: 12px 0 0 14px; color: #39754b; font-size: 12px; font-weight: 800; text-decoration: none; }
	.state button { margin-top: 12px; border: 1px solid #a44242; border-radius: 6px; background: #fff; color: #a44242; padding: 9px 12px; font: inherit; font-size: 12px; cursor: pointer; }
	@media (max-width: 600px) { .detail-page { width: min(100% - 28px, 920px); padding: 22px 0 48px; }.back-link { margin-bottom: 18px; }.detail-header { flex-direction: column; gap: 11px; padding: 18px; } h1 { font-size: 27px; line-height: 1.16; }.detail-subtitle { font-size: 12px; }.header-meta { justify-items: start; gap: 8px; }.context-grid { grid-template-columns: 1fr; gap: 7px; padding: 14px 18px; }.context-grid > div { padding: 10px 12px; }.context-grid strong, .context-grid a { font-size: 13px; }.advice-section, .steps-section { padding: 18px; }.advice-section > p:last-child { font-size: 15px; }.steps-section li p { font-size: 13px; } }
</style>