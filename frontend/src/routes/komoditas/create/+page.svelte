<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { createCommodity, type CommodityPayload } from '$lib/api/commodity-api';

	let isSaving = $state(false);
	let errorMessage = $state('');
	let form = $state<CommodityPayload>({ name: '', variety: '', avg_harvest_days: 90, max_humidity_percentage: 80, max_temp_celsius: 32, min_temp_celsius: 18 });
	let fromFarmland = $derived(page.url.searchParams.get('from') === 'farmland-create');

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault(); isSaving = true; errorMessage = '';
		try {
			const commodity = await createCommodity({ ...form, avg_harvest_days: Number(form.avg_harvest_days), max_humidity_percentage: Number(form.max_humidity_percentage), max_temp_celsius: Number(form.max_temp_celsius), min_temp_celsius: Number(form.min_temp_celsius) });
			if (fromFarmland) {
				const draft = sessionStorage.getItem('farmland-create-draft');
				if (draft) sessionStorage.setItem('farmland-create-draft', JSON.stringify({ ...JSON.parse(draft), commodity_id: commodity.id }));
				goto('/lahan-tani/create');
			} else goto(`/komoditas/${commodity.id}`);
		} catch (error: any) { errorMessage = error.message || 'Gagal membuat komoditas.'; }
		finally { isSaving = false; }
	}
</script>

<svelte:head><title>Buat Komoditas | Tani Siaga</title></svelte:head>
<div class="kerangka-halaman"><div class="wadah-halaman"><a class="tautan-kembali" href={fromFarmland ? '/lahan-tani/create' : '/komoditas'}>← Kembali</a><div class="judul"><p class="label-kecil">KATALOG PERTANIAN</p><h1 class="judul">Buat komoditas</h1><p class="subjudul">{fromFarmland ? 'Komoditas baru akan langsung tersedia untuk lahan yang sedang kamu buat.' : 'Tambahkan parameter dasar tanaman ke katalog Tani Siaga.'}</p></div>{#if errorMessage}<div class="peringatan">{errorMessage}</div>{/if}<form class="kartu-formulir" onsubmit={handleSubmit}><div class="kisi-formulir"><label>Nama komoditas<input bind:value={form.name} required placeholder="Contoh: Cabai merah" /></label><label>Varietas <span>Opsional</span><input bind:value={form.variety} placeholder="Contoh: Keriting" /></label><label>Rata-rata hari panen<input type="number" min="1" bind:value={form.avg_harvest_days} required /></label><label>Kelembapan maksimum (%)<input type="number" min="0" max="100" step="0.1" bind:value={form.max_humidity_percentage} required /></label><label>Suhu maksimum (°C)<input type="number" step="0.1" bind:value={form.max_temp_celsius} required /></label><label>Suhu minimum (°C)<input type="number" step="0.1" bind:value={form.min_temp_celsius} required /></label></div><div class="aksi"><a href={fromFarmland ? '/lahan-tani/create' : '/komoditas'}>Batal</a><button type="submit" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan komoditas'}</button></div></form></div></div>
<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f4f7f1;
		color: #183126;
		padding: 36px 20px 68px;
	}
	.wadah-halaman {
		max-width: 760px;
		margin: auto;
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
		margin-bottom: 28px;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	.judul h1 {
		margin: 0;
		font-size: clamp(38px,6vw,56px);
		line-height: 1.02;
	}
	.subjudul {
		color: #718077;
		line-height: 1.6;
	}
	.kartu-formulir {
		display: grid;
		gap: 28px;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 28px;
		box-shadow: 0 8px 22px #23472e0a;
	}
	.kisi-formulir {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
	}
	label {
		display: grid;
		gap: 8px;
		color: #385540;
		font-size: 13px;
		font-weight: 700;
	}
	label span {
		color: #718077;
		font-weight: 400;
	}
	input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		padding: 12px 13px;
		background: #fbfdfb;
		color: #183126;
		font: inherit;
		outline: 0;
	}
	input:focus {
		border-color: #39754b;
		box-shadow: 0 0 0 3px #39754b1c;
	}
	.aksi {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		border-top: 1px solid #e8eee6;
		padding-top: 20px;
	}
	.aksi a,.aksi button {
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		padding: 11px 14px;
		background: #fff;
		color: #39754b;
		font: 700 13px inherit;
		text-decoration: none;
		cursor: pointer;
	}
	.aksi button {
		border-color: #39754b;
		background: #39754b;
		color: #fff;
	}
	.aksi button:disabled {
		opacity: .6;
	}
	.peringatan {
		margin-bottom: 16px;
		padding: 13px;
		border-radius: 7px;
		background: #fff0ef;
		color: #a44242;
		font-size: 13px;
	}
	@media (max-width:600px) {
		.kisi-formulir {
			grid-template-columns: 1fr;
		}
	}
</style>
