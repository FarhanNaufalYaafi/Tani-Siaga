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

<main class="halaman-rincian">
	<a class="tautan-kembali" href="/ai-recommendations">← Kembali ke Rekomendasi AI</a>
	{#if isLoading}
		<div class="keadaan">Memuat detail rekomendasi...</div>
	{:else if errorMessage}
		<div class="keadaan galat" role="alert"><p>{errorMessage}</p><button type="button" onclick={() => void loadRecommendation()}>Coba lagi</button><a href="/ai-recommendations">Kembali ke daftar rekomendasi</a></div>
	{:else if recommendation}
		<article class="rincian-rekomendasi">
			<header class="bilah-rincian">
				<div><p class="label-kecil">PENDAMPING LAHAN · GEMINI</p><h1 class="judul">{recommendation.summary}</h1><p class="subjudul-rincian">Saran aksi untuk merawat komoditas berdasarkan kondisi lahan.</p></div>
			<div class="informasi-bilah"><span class="lencana-aksi">{recommendation.action_type}</span><time>{formatDate(recommendation.created_at)}</time></div>
			</header>

			<section class="kisi-konteks" aria-label="Konteks rekomendasi">
				<div><span>LAHAN</span>{#if recommendation.farmland?.id}<a href={`/lahan-tani/${recommendation.farmland.id}`}>{recommendation.farmland.name}<span aria-hidden="true">↗</span></a>{:else}<strong>{recommendation.farmland?.name || 'Informasi lahan tidak tersedia'}</strong>{/if}</div>
				<div><span>KOMODITAS</span><strong>{recommendation.farmland?.commodity?.name || 'Belum ditentukan'}</strong></div>
				<div><span>PROVINSI</span><strong>{provinceName}</strong></div>
			</section>

			<section class="bagian-saran">
				<p class="label-kecil">RINGKASAN SARAN</p>
				<p>{recommendation.detailed_advice}</p>
			</section>

			<section class="bagian-langkah">
				<p class="label-kecil">LANGKAH YANG DISARANKAN</p>
				{#if recommendation.step_by_step_steps?.length}<ol>{#each recommendation.step_by_step_steps as step, index}<li><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>{/each}</ol>{:else}<p class="redup">Belum ada langkah rinci untuk rekomendasi ini.</p>{/if}
			</section>
		</article>
	{/if}
</main>

<style>
	.halaman-rincian {
		width: min(100% - 56px, 920px);
		margin: 0 auto;
		padding: 38px 0 80px;
		color: #183126;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 22px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.rincian-rekomendasi {
		overflow: hidden;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		box-shadow: 0 8px 24px #23472e0a;
	}
	.bilah-rincian {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 24px;
		padding: 30px;
		border-bottom: 1px solid #e8eee6;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	h1 {
		max-width: 680px;
		margin: 0;
		font: 600 40px/1.1 'Fraunces', Georgia, serif;
		overflow-wrap: anywhere;
	}
	.subjudul-rincian {
		margin: 10px 0 0;
		color: #718077;
		font-size: 13px;
	}
	.informasi-bilah {
		display: grid;
		justify-items: end;
		gap: 12px;
		flex: 0 0 auto;
	}
	time {
		color: #829087;
		font-size: 10px;
	}
	.lencana-aksi {
		border-radius: 4px;
		background: #fff4dc;
		color: #875c22;
		padding: 7px 9px;
		font-size: 10px;
		font-weight: 800;
	}
	.kisi-konteks {
		display: grid;
		grid-template-columns: 1.3fr 1fr 1fr;
		gap: 10px;
		padding: 18px 30px;
		border-bottom: 1px solid #e8eee6;
	}
	.kisi-konteks > div {
		display: grid;
		align-content: start;
		gap: 7px;
		min-width: 0;
		border-left: 3px solid #77a87b;
		background: #f4f8f2;
		padding: 12px 14px;
	}
	.kisi-konteks > div > span {
		color: #718077;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: .12em;
	}
	.kisi-konteks strong, .kisi-konteks a {
		color: #274a32;
		font-size: 14px;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.kisi-konteks a {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		color: #39754b;
		text-decoration: none;
	}
	.bagian-saran, .bagian-langkah {
		padding: 24px 30px;
	}
	.bagian-saran {
		border-bottom: 1px solid #e8eee6;
		background: #f4faf2;
	}
	.bagian-saran > p:last-child {
		margin: 0;
		color: #274a32;
		font: 600 18px/1.55 'Fraunces', Georgia, serif;
		white-space: pre-line;
	}
	.bagian-langkah ol {
		display: grid;
		gap: 9px;
		margin: 14px 0 0;
		padding: 0;
		list-style: none;
	}
	.bagian-langkah li {
		display: grid;
		grid-template-columns: 34px 1fr;
		align-items: start;
		gap: 12px;
		border-bottom: 1px solid #e8eee6;
		padding: 12px 0;
	}
	.bagian-langkah li > span {
		color: #39754b;
		font-size: 11px;
		font-weight: 800;
	}
	.bagian-langkah li p {
		margin: 0;
		color: #53665a;
		font-size: 14px;
		line-height: 1.65;
		white-space: pre-line;
	}
	.redup {
		color: #718077;
		font-size: 13px;
	}
	.keadaan {
		border: 1px solid #d6e1d5;
		border-radius: 9px;
		background: #fff;
		padding: 42px 20px;
		color: #718077;
		text-align: center;
	}
	.keadaan.galat {
		border-color: #e6b8b3;
		background: #fff0ef;
		color: #a44242;
	}
	.keadaan p {
		margin: 0;
	}
	.keadaan a {
		display: inline-block;
		margin: 12px 0 0 14px;
		color: #39754b;
		font-size: 12px;
		font-weight: 800;
		text-decoration: none;
	}
	.keadaan button {
		margin-top: 12px;
		border: 1px solid #a44242;
		border-radius: 6px;
		background: #fff;
		color: #a44242;
		padding: 9px 12px;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	@media (max-width: 600px) {
		.halaman-rincian {
			width: min(100% - 28px, 920px);
			padding: 22px 0 48px;
		}
		.tautan-kembali {
			margin-bottom: 18px;
		}
		.bilah-rincian {
			flex-direction: column;
			gap: 11px;
			padding: 18px;
		}
		h1 {
			font-size: 27px;
			line-height: 1.16;
		}
		.subjudul-rincian {
			font-size: 12px;
		}
		.informasi-bilah {
			justify-items: start;
			gap: 8px;
		}
		.kisi-konteks {
			grid-template-columns: 1fr;
			gap: 7px;
			padding: 14px 18px;
		}
		.kisi-konteks > div {
			padding: 10px 12px;
		}
		.kisi-konteks strong, .kisi-konteks a {
			font-size: 13px;
		}
		.bagian-saran, .bagian-langkah {
			padding: 18px;
		}
		.bagian-saran > p:last-child {
			font-size: 15px;
		}
		.bagian-langkah li p {
			font-size: 13px;
		}
	}
</style>