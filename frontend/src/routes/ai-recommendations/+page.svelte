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

<main class="halaman-rekomendasi">
	<a class="tautan-kembali" href="/dashboard">← Dashboard</a>
	<header class="judul-halaman">
		<div>
			<p class="label-kecil">PENDAMPING LAHAN · GEMINI</p>
			<h1 class="judul">Rekomendasi AI</h1>
			<p class="subjudul">Langkah perawatan tanaman berdasarkan komoditas, lokasi, dan kondisi lahanmu.</p>
		</div>
		{#if !isLoading && !errorMessage}<span class="jumlah-total">{total} rekomendasi</span>{/if}
	</header>

	{#if errorMessage}
		<div class="keadaan galat" role="alert"><p>{errorMessage}</p><button type="button" onclick={() => void loadRecommendations(page)}>Coba lagi</button></div>
	{:else if isLoading}
		<div class="keadaan">Memuat rekomendasi AI...</div>
	{:else if recommendations.length === 0}
		<div class="keadaan kosong"><strong>Belum ada rekomendasi AI.</strong><p>Rekomendasi akan muncul setelah lahan aktif memiliki data cuaca dan komoditas.</p><a href="/lahan-tani">Lihat lahan tani →</a></div>
	{:else}
		<section class="kisi-rekomendasi" aria-label="Rekomendasi AI per lahan">
			{#each recommendations as item (item.id)}
				<a class="kartu-rekomendasi" href={`/ai-recommendations/${item.id}`}>
					<div class="baris-kartu"><span class="penanda-sumber">AI</span><time>{formatDate(item.created_at)}</time></div>
					<div class="judul-kartu"><p class="label-kecil">AKSI DISARANKAN</p><span class="lencana-aksi">{item.action_type}</span></div>
					<h2>{item.summary}</h2>
					<div class="kisi-konteks">
						<div><span>Lahan</span><strong>{item.farmland?.name || 'Informasi lahan tidak tersedia'}</strong></div>
						<div><span>Komoditas</span><strong>{item.farmland?.commodity?.name || 'Belum ditentukan'}</strong></div>
						<div><span>Provinsi</span><strong>{item.provinceName}</strong></div>
					</div>
					<p class="ringkasan">{item.detailed_advice}</p>
					{#if item.step_by_step_steps?.[0]}<p class="langkah-pertama"><strong>Langkah pertama</strong>{item.step_by_step_steps[0]}</p>{/if}
					<span class="tautan-rincian">Buka rekomendasi <span aria-hidden="true">↗</span></span>
				</a>
			{/each}
		</section>
		<Pagination {page} {totalPages} onPageChange={(nextPage) => void loadRecommendations(nextPage)} disabled={isLoading} />
	{/if}
</main>

<style>
	.halaman-rekomendasi {
		width: min(100% - 56px, 1100px);
		margin: 0 auto;
		padding: 38px 0 80px;
		color: #183126;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 28px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.judul-halaman {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 28px;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	h1 {
		margin: 0;
		font: 600 52px/1 'Fraunces', Georgia, serif;
	}
	.subjudul {
		max-width: 650px;
		margin: 12px 0 0;
		color: #718077;
		font-size: 14px;
		line-height: 1.6;
	}
	.jumlah-total {
		color: #718077;
		font-size: 12px;
		white-space: nowrap;
	}
	.kisi-rekomendasi {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}
	.kartu-rekomendasi {
		display: grid;
		gap: 13px;
		min-width: 0;
		border: 1px solid #d6e1d5;
		border-radius: 9px;
		background: #fff;
		padding: 20px;
		color: inherit;
		text-decoration: none;
		transition: border-color .18s, transform .18s, box-shadow .18s;
	}
	.kartu-rekomendasi:hover {
		transform: translateY(-2px);
		border-color: #77a87b;
		box-shadow: 0 10px 24px #23472e10;
	}
	.baris-kartu, .judul-kartu {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.penanda-sumber {
		display: inline-grid;
		place-items: center;
		min-width: 36px;
		height: 26px;
		border-radius: 4px;
		background: #39754b;
		color: #fff;
		font: 800 10px Arial,sans-serif;
	}
	time {
		color: #829087;
		font-size: 10px;
	}
	.judul-kartu .label-kecil {
		margin: 0;
	}
	.lencana-aksi {
		border-radius: 4px;
		background: #fff4dc;
		color: #875c22;
		padding: 6px 8px;
		font-size: 9px;
		font-weight: 800;
	}
	h2 {
		margin: 0;
		font: 600 25px/1.15 'Fraunces', Georgia, serif;
		overflow-wrap: anywhere;
	}
	.kisi-konteks {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 7px;
	}
	.kisi-konteks > div {
		display: grid;
		gap: 4px;
		min-width: 0;
		border-left: 2px solid #77a87b;
		background: #f4f8f2;
		padding: 8px 10px;
	}
	.kisi-konteks > div:first-child {
		grid-column: 1 / -1;
	}
	.kisi-konteks span {
		color: #718077;
		font-size: 9px;
	}
	.kisi-konteks strong {
		color: #274a32;
		font-size: 11px;
		overflow-wrap: anywhere;
	}
	.ringkasan {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
		margin: 0;
		color: #53665a;
		font-size: 12px;
		line-height: 1.6;
	}
	.langkah-pertama {
		display: grid;
		gap: 4px;
		margin: 0;
		border-top: 1px solid #e8eee6;
		padding-top: 11px;
		color: #385540;
		font-size: 11px;
		line-height: 1.5;
	}
	.langkah-pertama strong {
		color: #718077;
		font-size: 9px;
		text-transform: uppercase;
	}
	.tautan-rincian {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: auto;
		padding-top: 5px;
		color: #39754b;
		font-size: 11px;
		font-weight: 800;
	}
	.keadaan {
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #fff;
		padding: 42px 20px;
		color: #718077;
		text-align: center;
	}
	.keadaan p {
		margin: 8px 0 0;
		font-size: 13px;
	}
	.keadaan a {
		display: inline-block;
		margin-top: 14px;
		color: #39754b;
		font-size: 12px;
		font-weight: 800;
		text-decoration: none;
	}
	.keadaan.galat {
		border-color: #e6b8b3;
		background: #fff0ef;
		color: #a44242;
	}
	.keadaan button {
		margin-top: 14px;
		border: 1px solid #a44242;
		border-radius: 6px;
		background: #fff;
		color: #a44242;
		padding: 9px 12px;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	@media (max-width: 700px) {
		.halaman-rekomendasi {
			width: min(100% - 32px, 1100px);
			padding-top: 24px;
		}
		.tautan-kembali {
			margin-bottom: 20px;
		}
		.judul-halaman {
			align-items: flex-start;
			flex-direction: column;
			gap: 9px;
			margin-bottom: 22px;
		}
		h1 {
			font-size: 32px;
			line-height: 1.08;
		}
		.subjudul {
			margin-top: 9px;
			font-size: 13px;
		}
		.kisi-rekomendasi {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.kartu-rekomendasi {
			gap: 11px;
			padding: 14px;
		}
		h2 {
			font-size: 21px;
		}
		.kisi-konteks {
			gap: 6px;
		}
		.kisi-konteks > div {
			padding: 7px 9px;
		}
		.ringkasan {
			font-size: 11px;
		}
		.langkah-pertama {
			font-size: 10px;
		}
	}
</style>