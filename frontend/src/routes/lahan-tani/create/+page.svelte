<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createFarmland, type FarmlandPayload } from '$lib/api/farmland-api';
	import { getCommodities, type Commodity } from '$lib/api/commodity-api';
	import { getProvinces, getRegencies, getDistricts, getVillages, type WilayahItem } from '$lib/api/wilayah-api';

	let commodities = $state<Commodity[]>([]);
	let search = $state('');
	let pageNumber = $state(1);
	let isLoadingCommodities = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let provinces = $state<WilayahItem[]>([]);
	let regencies = $state<WilayahItem[]>([]);
	let districts = $state<WilayahItem[]>([]);
	let villages = $state<WilayahItem[]>([]);
	let selectedProvince = $state('');
	let selectedRegency = $state('');
	let selectedDistrict = $state('');
	let selectedVillage = $state('');
	const pageSize = 8;

	let form = $state<FarmlandPayload>({
		name: '', area_size: 0, adm4_code: '', address_detail: '', plant_date: '', plant_method: '', commodity_id: undefined,
		latitude: undefined, longitude: undefined, expected_yield_user_kg: undefined
	});

	let filteredCommodities = $derived(commodities.filter((commodity) => {
		const query = search.trim().toLowerCase();
		return !query || `${commodity.name} ${commodity.variety || ''}`.toLowerCase().includes(query);
	}));
	let totalPages = $derived(Math.max(1, Math.ceil(filteredCommodities.length / pageSize)));
	let visibleCommodities = $derived(filteredCommodities.slice((pageNumber - 1) * pageSize, pageNumber * pageSize));

	$effect(() => {
		if (pageNumber > totalPages) pageNumber = totalPages;
	});

	onMount(() => {
		const draft = sessionStorage.getItem('farmland-create-draft');
		if (draft) {
			try { form = { ...form, ...JSON.parse(draft) }; } catch { sessionStorage.removeItem('farmland-create-draft'); }
		}
		void loadCommodities();
		void loadProvinces();
	});

	async function loadProvinces() {
		try { provinces = await getProvinces(); }
		catch (error: any) { errorMessage = error.message || 'Gagal memuat provinsi.'; }
	}

	async function handleProvinceChange() {
		selectedRegency = ''; selectedDistrict = ''; selectedVillage = '';
		regencies = []; districts = []; villages = []; form.adm4_code = '';
		if (selectedProvince) regencies = await getRegencies(selectedProvince);
	}

	async function handleRegencyChange() {
		selectedDistrict = ''; selectedVillage = '';
		districts = []; villages = []; form.adm4_code = '';
		if (selectedRegency) districts = await getDistricts(selectedRegency);
	}

	async function handleDistrictChange() {
		selectedVillage = ''; villages = []; form.adm4_code = '';
		if (selectedDistrict) villages = await getVillages(selectedDistrict);
	}

	function handleVillageChange() {
		form.adm4_code = selectedVillage;
	}

	async function loadCommodities() {
		try { commodities = await getCommodities(); }
		catch (error: any) { errorMessage = error.message || 'Gagal memuat komoditas.'; }
		finally { isLoadingCommodities = false; }
	}

	function selectCommodity(id: number) { form.commodity_id = id; }

	function createNewCommodity() {
		sessionStorage.setItem('farmland-create-draft', JSON.stringify(form));
		goto('/komoditas/create?from=farmland-create');
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		isSaving = true; errorMessage = ''; successMessage = '';
		try {
			const created = await createFarmland({ ...form, area_size: Number(form.area_size), commodity_id: form.commodity_id || undefined });
			sessionStorage.removeItem('farmland-create-draft');
			goto(`/lahan-tani/${created.id}`);
		} catch (error: any) { errorMessage = error.message || 'Gagal membuat lahan tani.'; }
		finally { isSaving = false; }
	}
</script>

<svelte:head><title>Tambah Lahan Tani | Tani Siaga</title></svelte:head>

<div class="kerangka-halaman"><div class="wadah-halaman">
	<a class="tautan-kembali" href="/lahan-tani">← Kembali ke Lahan Tani</a>
	<div class="judul-halaman"><p class="label-kecil">DATA LAHAN</p><h1 class="judul">Tambah Lahan Tani</h1><p class="subjudul">Lengkapi data lahan dan pilih komoditas dari katalog yang tersedia.</p></div>

	{#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
	{#if successMessage}<div class="peringatan berhasil">{successMessage}</div>{/if}

	<form class="kartu-formulir" onsubmit={handleSubmit}>
		<div class="kisi-bidang">
			<label>Nama lahan<input bind:value={form.name} required placeholder="Contoh: Sawah Blok A" /></label>
			<label>Luas area (m²)<input type="number" min="0.01" step="0.01" bind:value={form.area_size} required /></label>
			<div class="bidang-lokasi"><span class="label-bidang">Lokasi lahan</span><div class="kisi-lokasi"><select bind:value={selectedProvince} onchange={handleProvinceChange} required><option value="">Pilih provinsi</option>{#each provinces as item}<option value={item.code}>{item.name}</option>{/each}</select><select bind:value={selectedRegency} onchange={handleRegencyChange} disabled={!selectedProvince} required><option value="">Pilih kabupaten/kota</option>{#each regencies as item}<option value={item.code}>{item.name}</option>{/each}</select><select bind:value={selectedDistrict} onchange={handleDistrictChange} disabled={!selectedRegency} required><option value="">Pilih kecamatan</option>{#each districts as item}<option value={item.code}>{item.name}</option>{/each}</select><select bind:value={selectedVillage} onchange={handleVillageChange} disabled={!selectedDistrict} required><option value="">Pilih desa/kelurahan</option>{#each villages as item}<option value={item.code}>{item.name}</option>{/each}</select></div><small>ADM4 otomatis: {form.adm4_code || 'pilih desa/kelurahan'}</small></div>
			<label>Metode tanam<input bind:value={form.plant_method} required placeholder="Contoh: Konvensional" /></label>
			<label>Tanggal tanam<input type="date" bind:value={form.plant_date} /></label>
			<label>Hasil panen estimasi (kg)<input type="number" min="0" step="0.01" bind:value={form.expected_yield_user_kg} /></label>
			<label>Latitude<input type="number" step="any" bind:value={form.latitude} /></label>
			<label>Longitude<input type="number" step="any" bind:value={form.longitude} /></label>
		</div>
		<label>Alamat detail<textarea bind:value={form.address_detail} rows="3" placeholder="Alamat atau patokan lahan"></textarea></label>

		<section class="bagian-komoditas">
			<div class="judul-bagian"><div><p class="label-kecil">KATALOG</p><h2>Pilih Komoditas</h2></div><div class="alat-bagian"><span class="terpilih">{form.commodity_id ? 'Komoditas dipilih' : 'Belum dipilih'}</span><button type="button" class="komoditas-baru" onclick={createNewCommodity}>+ Komoditas baru</button></div></div>
			<input class="cari" bind:value={search} oninput={() => (pageNumber = 1)} placeholder="Cari nama atau varietas komoditas..." aria-label="Cari komoditas" />
			{#if isLoadingCommodities}<p class="redup">Memuat katalog komoditas...</p>
			{:else if visibleCommodities.length === 0}<p class="redup">Komoditas tidak ditemukan.</p>
			{:else}<div class="kisi-komoditas">{#each visibleCommodities as commodity (commodity.id)}<button type="button" class:terpilih={form.commodity_id === commodity.id} class="kartu-komoditas" onclick={() => selectCommodity(commodity.id)}><strong>{commodity.name}</strong><span>{commodity.variety || 'Varietas umum'}</span></button>{/each}</div>{/if}
			{#if totalPages > 1}<div class="halaman"><button type="button" disabled={pageNumber === 1} onclick={() => (pageNumber -= 1)}>Sebelumnya</button><span>{pageNumber} / {totalPages}</span><button type="button" disabled={pageNumber === totalPages} onclick={() => (pageNumber += 1)}>Berikutnya</button></div>{/if}
			{#if form.commodity_id}
				<div class="preferensi-khusus"><div><p class="label-kecil">PREFERENSI PETANI · OPSIONAL</p><h3>Sesuaikan parameter tanaman</h3><p class="redup">Bagian ini opsional. Kosongkan jika ingin memakai parameter bawaan komoditas untuk rekomendasi AI.</p></div><div class="kisi-preferensi"><label>Suhu maksimum (°C) <span class="opsional">Opsional</span><input type="number" step="0.1" bind:value={form.custom_max_temp_celsius} placeholder="Contoh: 35" /></label><label>Suhu minimum (°C) <span class="opsional">Opsional</span><input type="number" step="0.1" bind:value={form.custom_min_temp_celsius} placeholder="Contoh: 18" /></label><label>Kelembapan maksimum (%) <span class="opsional">Opsional</span><input type="number" min="0" max="100" step="0.1" bind:value={form.custom_max_humidity_percentage} placeholder="Contoh: 85" /></label><label>Rata-rata hari panen <span class="opsional">Opsional</span><input type="number" min="1" step="1" bind:value={form.custom_avg_harvest_days} placeholder="Contoh: 90" /></label></div></div>
			{/if}
		</section>

		<div class="aksi-formulir"><a href="/lahan-tani">Batal</a><button class="utama" type="submit" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan Lahan'}</button></div>
	</form>
</div></div>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f4f7f1;
		color: #183126;
		padding: 36px 20px 68px;
	}
	.wadah-halaman {
		max-width: 950px;
		margin: auto;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 24px;
		color: #39754b;
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
	}
	.judul-halaman {
		margin-bottom: 28px;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	h1 {
		margin: 0;
		font-size: clamp(32px,5vw,46px);
		line-height: 1.1;
	}
	.subjudul,.redup {
		color: #718077;
		font-size: 15px;
	}
	.kartu-formulir {
		display: grid;
		gap: 24px;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 30px;
		box-shadow: 0 8px 22px #23472e0f;
	}
	label {
		display: grid;
		gap: 8px;
		color: #385540;
		font-size: 13px;
		font-weight: 700;
	}
	.label-bidang {
		display: block;
		color: #385540;
		font-size: 13px;
		font-weight: 700;
	}
	input,textarea,.cari,select {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fbfdfb;
		color: #183126;
		padding: 12px 13px;
		font: inherit;
		font-weight: 400;
		outline: none;
	}
	input:focus,textarea:focus,.cari:focus,select:focus {
		border-color: #5c9568;
		box-shadow: 0 0 0 3px #5c95681c;
	}
	select:disabled {
		opacity: .55;
	}
	.kisi-bidang {
		display: grid;
		grid-template-columns: repeat(2,1fr);
		gap: 18px;
	}
	.bidang-lokasi {
		display: grid;
		gap: 8px;
		grid-column: span 2;
	}
	.kisi-lokasi {
		display: grid;
		grid-template-columns: repeat(4,1fr);
		gap: 10px;
	}
	.bidang-lokasi small {
		color: #718077;
		font-size: 12px;
	}
	.bagian-komoditas {
		border-top: 1px solid #e8eee6;
		padding-top: 24px;
	}
	.judul-bagian {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 16px;
	}
	h2 {
		margin: 0;
		font-size: 21px;
	}
	.terpilih {
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
	}
	.kisi-komoditas {
		display: grid;
		grid-template-columns: repeat(4,1fr);
		gap: 11px;
		margin-top: 13px;
	}
	.kartu-komoditas {
		display: grid;
		gap: 6px;
		text-align: left;
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #f9fbf8;
		padding: 13px;
		color: #274a32;
		cursor: pointer;
	}
	.kartu-komoditas span {
		color: #718077;
		font-size: 12px;
	}
	.kartu-komoditas.terpilih {
		border-color: #39754b;
		background: #eaf4e9;
		box-shadow: inset 0 0 0 1px #39754b;
	}
	.halaman {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 15px;
		margin-top: 17px;
		color: #66766d;
		font-size: 13px;
	}
	.halaman button,.aksi-formulir a {
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fff;
		color: #39754b;
		padding: 9px 12px;
		font-size: 13px;
		text-decoration: none;
		cursor: pointer;
	}
	.halaman button:disabled {
		opacity: .45;
		cursor: not-allowed;
	}
	.aksi-formulir {
		display: flex;
		justify-content: flex-end;
		gap: 11px;
		border-top: 1px solid #e8eee6;
		padding-top: 22px;
	}
	.aksi-formulir .utama {
		border: 0;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 12px 18px;
		font-weight: 700;
		cursor: pointer;
	}
	.aksi-formulir button:disabled {
		opacity: .6;
		cursor: not-allowed;
	}
	.peringatan {
		border-radius: 7px;
		padding: 13px 15px;
		margin-bottom: 17px;
		font-size: 14px;
	}
	.peringatan.galat {
		background: #fff0ef;
		color: #a44242;
	}
	.peringatan.berhasil {
		background: #edf8ed;
		color: #39754b;
	}
	@media (max-width:700px) {
		.kerangka-halaman {
			padding: 28px 14px 52px;
		}
		.kartu-formulir {
			padding: 22px;
		}
		.kisi-bidang {
			grid-template-columns: 1fr;
		}
		.bidang-lokasi {
			grid-column: auto;
		}
		.kisi-lokasi {
			grid-template-columns: 1fr 1fr;
		}
		.kisi-komoditas {
			grid-template-columns: repeat(2,1fr);
		}
		.judul-bagian {
			align-items: start;
			gap: 12px;
			flex-direction: column;
		}
	}
	.preferensi-khusus {
		margin-top: 22px;
		padding: 20px;
		border: 1px solid #cfe2cd;
		border-radius: 9px;
		background: #f4faf2;
	}
	.preferensi-khusus h3 {
		margin: 0;
		color: #274a32;
		font-size: 18px;
	}
	.kisi-preferensi {
		display: grid;
		grid-template-columns: repeat(2,1fr);
		gap: 16px;
		margin-top: 18px;
	}
	.alat-bagian {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.komoditas-baru {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 38px;
		border: 1px solid #39754b;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 9px 13px;
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		line-height: 1.2;
		white-space: nowrap;
		cursor: pointer;
		transition: background-color .18s ease,border-color .18s ease,box-shadow .18s ease;
	}
	.komoditas-baru:hover {
		border-color: #2d603c;
		background: #2d603c;
	}
	.komoditas-baru:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 2px;
	}
	@media (max-width:560px) {
		.judul-bagian {
			align-items: flex-start;
			gap: 12px;
			flex-wrap: wrap;
		}
		.alat-bagian {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
