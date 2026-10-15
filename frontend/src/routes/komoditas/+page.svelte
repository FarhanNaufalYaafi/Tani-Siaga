<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import {
		deleteCommodity,
		getCommoditiesPage,
		updateCommodity,
		type Commodity,
		type CommodityPayload,
	} from '$lib/api/commodity-api';
	import type { PaginationMeta } from '$lib/api/pagination';
	import Pagination from '$lib/components/Pagination.svelte';
	import { showAlert, showConfirm } from '$lib/services/dialog';

	let commodities = $state<Commodity[]>([]);
	let currentUser = $state<CurrentUserDto | null>(null);
	let search = $state('');
	let page = $state(1);
	const pageSize = 8;
	let pagination = $state<PaginationMeta>({ page: 1, limit: pageSize, total: 0, total_pages: 1 });
	let isLoading = $state(true);
	let errorMessage = $state('');
	let notice = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let editingId = $state<number | null>(null);
	let isSaving = $state(false);
	let form = $state<CommodityPayload>(emptyForm());
	let isAdmin = $derived(currentUser?.role === 'admin');

	function emptyForm(): CommodityPayload {
		return { name: '', variety: '', avg_harvest_days: 90, max_humidity_percentage: 80, max_temp_celsius: 32, min_temp_celsius: 18 };
	}

	onMount(async () => {
		try { currentUser = await getCurrentUser(); } catch { currentUser = null; }
		await loadCommodities(1);
	});

	async function loadCommodities(requestedPage = page, showLoading = true) {
		if (showLoading) isLoading = true;
		errorMessage = '';
		try {
			const result = await getCommoditiesPage(requestedPage, pageSize, search);
			if (requestedPage > result.meta.total_pages && result.meta.total > 0) {
				await loadCommodities(result.meta.total_pages, showLoading);
				return;
			}
			commodities = result.data;
			pagination = result.meta;
			page = result.meta.page;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memuat katalog komoditas.';
		} finally {
			if (showLoading) isLoading = false;
		}
	}

	function handleSearch() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => { page = 1; void loadCommodities(1); }, 300);
	}

	function changePage(nextPage: number) { page = nextPage; void loadCommodities(nextPage); }

	function toggleEdit(commodity: Commodity) {
		if (editingId === commodity.id) {
			editingId = null;
			return;
		}
		notice = '';
		errorMessage = '';
		editingId = commodity.id;
		form = {
			name: commodity.name,
			variety: commodity.variety || '',
			avg_harvest_days: commodity.avg_harvest_days,
			max_humidity_percentage: commodity.max_humidity_percentage,
			max_temp_celsius: commodity.max_temp_celsius,
			min_temp_celsius: commodity.min_temp_celsius,
		};
	}

	async function saveCommodity(event: SubmitEvent) {
		event.preventDefault();
		if (editingId === null) return;
		isSaving = true;
		errorMessage = '';
		try {
			await updateCommodity(editingId, {
				...form,
				name: form.name.trim(),
				variety: form.variety?.trim(),
				avg_harvest_days: Number(form.avg_harvest_days),
				max_humidity_percentage: Number(form.max_humidity_percentage),
				max_temp_celsius: Number(form.max_temp_celsius),
				min_temp_celsius: Number(form.min_temp_celsius),
			});
			editingId = null;
			notice = 'Perubahan komoditas berhasil disimpan.';
			await loadCommodities(page, false);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui komoditas.';
		} finally {
			isSaving = false;
		}
	}

	async function removeCommodity(commodity: Commodity) {
		if (!await showConfirm(`Komoditas "${commodity.name}" akan dihapus.`, { title: 'Hapus komoditas?', confirmLabel: 'Hapus', tone: 'error' })) return;
		try {
			await deleteCommodity(commodity.id);
			notice = `Komoditas "${commodity.name}" berhasil dihapus.`;
			await loadCommodities(page, false);
		} catch (error) {
			await showAlert(error instanceof Error ? error.message : 'Gagal menghapus komoditas.', { title: 'Tidak dapat menghapus', tone: 'error' });
		}
	}
</script>

<svelte:head><title>Komoditas | Tani Siaga</title></svelte:head>

<div class="kerangka-halaman">
	<div class="wadah-halaman">
		<a class="tautan-kembali" href="/dashboard">← Kembali ke Dashboard</a>
		<header class="judul">
			<div>
				<p class="label-kecil">KATALOG PERTANIAN</p>
				<h1 class="judul">Komoditas</h1>
				<p class="subjudul">Lihat parameter tanaman yang dipakai untuk rekomendasi dan analisis lahan.</p>
			</div>
			<a class="utama" href="/komoditas/create">+ Buat komoditas</a>
		</header>
		{#if notice}<div class="peringatan">{notice}</div>{/if}
		{#if errorMessage}<div class="peringatan">{errorMessage}</div>{/if}
		<div class="bilah">
			<input bind:value={search} oninput={handleSearch} placeholder="Cari nama atau varietas..." aria-label="Cari komoditas" />
			<span>{pagination.total} komoditas</span>
		</div>
		{#if isLoading}
			<div class="keadaan">Memuat katalog komoditas...</div>
		{:else if commodities.length === 0}
			<div class="keadaan">Komoditas belum ditemukan.</div>
		{:else}
			<div class="kisi">
				{#each commodities as commodity (commodity.id)}
					<article class="kartu-komoditas">
						<a class="utama-komoditas" href={`/komoditas/${commodity.id}`}>
							<span class="ikon-tanaman" aria-hidden="true">🌱</span>
							<span class="nama-komoditas"><strong>{commodity.name}</strong><small>{commodity.variety || 'Varietas umum'}</small></span>
							<span class="panah" aria-hidden="true">→</span>
							<span class="indikator">
								<span>Panen<strong>{commodity.avg_harvest_days} hari</strong></span>
								<span>Suhu<strong>{commodity.min_temp_celsius}–{commodity.max_temp_celsius}°C</strong></span>
								<span>Kelembapan<strong>≤ {commodity.max_humidity_percentage}%</strong></span>
							</span>
						</a>
						{#if isAdmin}
							<div class="aksi-admin">
								<button class="alih-ubah" type="button" aria-expanded={editingId === commodity.id} onclick={() => toggleEdit(commodity)}>
									{editingId === commodity.id ? 'Tutup ubah data' : 'Ubah data'} <span>{editingId === commodity.id ? '−' : '⌄'}</span>
								</button>
								<button class="tombol-hapus" type="button" onclick={() => removeCommodity(commodity)}>Hapus</button>
							</div>
							{#if editingId === commodity.id}
								<form class="panel-ubah" onsubmit={saveCommodity}>
									<label>Nama komoditas<input bind:value={form.name} required /></label>
									<label>Varietas<input bind:value={form.variety} /></label>
									<label>Rata-rata panen (hari)<input type="number" min="1" bind:value={form.avg_harvest_days} required /></label>
									<label>Kelembapan maksimum (%)<input type="number" min="0" max="100" step="0.1" bind:value={form.max_humidity_percentage} required /></label>
									<label>Suhu minimum (°C)<input type="number" step="0.1" bind:value={form.min_temp_celsius} required /></label>
									<label>Suhu maksimum (°C)<input type="number" step="0.1" bind:value={form.max_temp_celsius} required /></label>
									<div class="tombol-ubah">
										<button class="batal" type="button" onclick={() => (editingId = null)}>Batal</button>
										<button class="utama" type="submit" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan perubahan'}</button>
									</div>
								</form>
							{/if}
						{/if}
					</article>
				{/each}
			</div>
			<Pagination {page} totalPages={pagination.total_pages} onPageChange={changePage} disabled={isLoading} />
		{/if}
	</div>
</div>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f4f7f1;
		color: #183126;
		padding: 36px 20px 68px;
	}
	.wadah-halaman {
		width: min(100%, 1000px);
		margin: 0 auto;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 28px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.judul {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 24px;
		margin-bottom: 28px;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	h1 {
		margin: 0;
		font: 600 clamp(38px, 6vw, 56px)/1.02 'Fraunces', Georgia, serif;
	}
	.subjudul {
		max-width: 580px;
		margin: 14px 0 0;
		color: #718077;
		line-height: 1.6;
	}
	.utama {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 42px;
		border: 1px solid #39754b;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 11px 15px;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}
	.bilah {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
	}
	.bilah input {
		box-sizing: border-box;
		flex: 1;
		min-width: 0;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fff;
		padding: 13px;
		font: inherit;
		outline: 0;
	}
	.bilah input:focus, input:focus {
		border-color: #39754b;
		box-shadow: 0 0 0 3px #39754b1c;
	}
	.bilah span {
		color: #718077;
		font-size: 13px;
		white-space: nowrap;
	}
	.kisi {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}
	.kartu-komoditas {
		min-width: 0;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e0a;
		transition: transform .18s, border-color .18s, box-shadow .18s;
	}
	.kartu-komoditas:hover {
		transform: translateY(-2px);
		border-color: #77a87b;
		box-shadow: 0 12px 26px #23472e12;
	}
	.utama-komoditas {
		position: relative;
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr);
		gap: 4px 14px;
		padding: 20px;
		color: #183126;
		text-decoration: none;
	}
	.ikon-tanaman {
		grid-row: span 2;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: #eaf4e9;
		font-size: 23px;
	}
	.nama-komoditas {
		display: grid;
		gap: 4px;
		min-width: 0;
		padding-right: 22px;
	}
	.nama-komoditas strong {
		overflow-wrap: anywhere;
		font-size: 20px;
	}
	.nama-komoditas small {
		color: #718077;
		font-size: 13px;
	}
	.panah {
		position: absolute;
		top: 20px;
		right: 20px;
		color: #39754b;
		font-size: 18px;
	}
	.indikator {
		grid-column: 1/-1;
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}
	.indikator > span {
		flex: 1;
		min-width: 0;
		padding: 10px;
		background: #f7faf6;
		color: #718077;
		font-size: 10px;
	}
	.indikator strong {
		display: block;
		margin-top: 4px;
		color: #39754b;
		font-size: 12px;
	}
	.aksi-admin {
		display: flex;
		gap: 8px;
		border-top: 1px solid #e8eee6;
		padding: 0 20px 14px;
	}
	.aksi-admin button {
		min-height: 34px;
		border: 1px solid #39754b;
		border-radius: 6px;
		padding: 7px 10px;
		font: inherit;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.alih-ubah {
		flex: 1;
		display: flex;
		justify-content: space-between;
		background: #fff;
		color: #39754b;
		text-align: left;
	}
	.tombol-hapus {
		border-color: #edc9c6 !important;
		background: #fff0ef;
		color: #a44242;
	}
	.panel-ubah {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		border-top: 1px solid #e8eee6;
		padding: 16px 20px 20px;
	}
	.panel-ubah label {
		display: grid;
		gap: 6px;
		min-width: 0;
		color: #385540;
		font-size: 11px;
		font-weight: 700;
	}
	.panel-ubah input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		border: 1px solid #d6e1d5;
		border-radius: 6px;
		padding: 9px;
		background: #fbfdfb;
		color: #183126;
		font: inherit;
	}
	.tombol-ubah {
		grid-column: 1/-1;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.tombol-ubah button {
		min-height: 36px;
		border: 1px solid #39754b;
		border-radius: 6px;
		padding: 8px 12px;
		font: inherit;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.tombol-ubah button:disabled {
		opacity: .55;
		cursor: wait;
	}
	.batal {
		background: #fff;
		color: #39754b;
	}
	.peringatan, .peringatan, .keadaan {
		margin-bottom: 14px;
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #fff;
		padding: 12px 14px;
		color: #536d5a;
		font-size: 13px;
	}
	.peringatan {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	.keadaan {
		padding: 24px;
		text-align: center;
		color: #718077;
	}
	@media (max-width: 700px) {
		.kisi {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.kerangka-halaman {
			padding: 28px 14px 54px;
		}
		.judul {
			align-items: flex-start;
			flex-direction: column;
			gap: 18px;
			margin-bottom: 24px;
		}
		.utama {
			width: 100%;
		}
		.bilah {
			align-items: stretch;
			flex-direction: column;
			gap: 8px;
		}
		.bilah span {
			align-self: flex-end;
		}
		.panel-ubah {
			grid-template-columns: 1fr;
		}
		.tombol-ubah {
			grid-column: auto;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kartu-komoditas {
			transition: none;
		}
	}
</style>
