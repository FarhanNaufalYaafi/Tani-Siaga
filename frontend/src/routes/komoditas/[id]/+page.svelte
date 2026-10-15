<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { deleteCommodity, getCommodityById, updateCommodity, type Commodity, type CommodityPayload } from '$lib/api/commodity-api';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { showConfirm } from '$lib/services/dialog';

	let commodity = $state<Commodity | null>(null); let currentUser = $state<CurrentUserDto | null>(null); let isLoading = $state(true); let isEditing = $state(false); let isSaving = $state(false); let errorMessage = $state(''); let notice = $state('');
	let form = $state<CommodityPayload>({ name: '', variety: '', avg_harvest_days: 90, max_humidity_percentage: 80, max_temp_celsius: 32, min_temp_celsius: 18 });
	let isAdmin = $derived(currentUser?.role === 'admin');

	onMount(async () => { try { const id = page.params.id; if (!id) throw new Error('ID komoditas tidak ditemukan.'); const [item, user] = await Promise.all([getCommodityById(id), getCurrentUser()]); commodity = item; currentUser = user; form = { name: item.name, variety: item.variety || '', avg_harvest_days: item.avg_harvest_days, max_humidity_percentage: item.max_humidity_percentage, max_temp_celsius: item.max_temp_celsius, min_temp_celsius: item.min_temp_celsius }; } catch (error: any) { errorMessage = error.message || 'Gagal memuat detail komoditas.'; } finally { isLoading = false; } });

	async function save() { if (!commodity) return; isSaving = true; errorMessage = ''; try { commodity = await updateCommodity(commodity.id, { ...form, avg_harvest_days: Number(form.avg_harvest_days), max_humidity_percentage: Number(form.max_humidity_percentage), max_temp_celsius: Number(form.max_temp_celsius), min_temp_celsius: Number(form.min_temp_celsius) }); isEditing = false; notice = 'Perubahan komoditas berhasil diterapkan.'; } catch (error: any) { errorMessage = error.message || 'Gagal memperbarui komoditas.'; } finally { isSaving = false; } }
	async function remove() { if (!commodity) return; const confirmed = await showConfirm(`Komoditas "${commodity.name}" akan dihapus.`, { title: 'Hapus komoditas?', confirmLabel: 'Hapus', tone: 'error' }); if (!confirmed) return; try { await deleteCommodity(commodity.id); goto('/komoditas'); } catch (error: any) { errorMessage = error.message || 'Gagal menghapus komoditas.'; } }
</script>

<svelte:head><title>{commodity ? `${commodity.name} | Komoditas` : 'Detail Komoditas'}</title></svelte:head>
<div class="kerangka-halaman"><div class="wadah-halaman"><a class="tautan-kembali" href="/komoditas">← Kembali ke Komoditas</a>{#if isLoading}<div class="keadaan">Memuat detail komoditas...</div>{:else if errorMessage && !commodity}<div class="keadaan galat">{errorMessage}</div>{:else if commodity}<article class="kartu-rincian"><div class="bilah"><div><p class="label-kecil">DETAIL KOMODITAS</p><h1 class="judul">{commodity.name}</h1><p class="subjudul">{commodity.variety || 'Varietas umum'}</p></div><span class="ikon-tanaman">🌱</span></div>{#if notice}<div class="pesan-berhasil">{notice}</div>{/if}{#if errorMessage}<div class="pesan-galat">{errorMessage}</div>{/if}{#if isEditing}<form class="formulir-ubah" onsubmit={(event) => { event.preventDefault(); void save(); }}><div class="kisi-formulir"><label>Nama komoditas<input bind:value={form.name} required /></label><label>Varietas<input bind:value={form.variety} /></label><label>Rata-rata hari panen<input type="number" min="1" bind:value={form.avg_harvest_days} required /></label><label>Kelembapan maksimum (%)<input type="number" min="0" max="100" step="0.1" bind:value={form.max_humidity_percentage} required /></label><label>Suhu maksimum (°C)<input type="number" step="0.1" bind:value={form.max_temp_celsius} required /></label><label>Suhu minimum (°C)<input type="number" step="0.1" bind:value={form.min_temp_celsius} required /></label></div><div class="aksi"><button class="tenang" type="button" onclick={() => (isEditing = false)}>Batal</button><button type="submit" disabled={isSaving}>{isSaving ? 'Menerapkan...' : 'Terapkan perubahan'}</button></div></form>{:else}<div class="fakta"><div><span>Rata-rata panen</span><strong>{commodity.avg_harvest_days} hari</strong></div><div><span>Suhu ideal</span><strong>{commodity.min_temp_celsius}–{commodity.max_temp_celsius}°C</strong></div><div><span>Kelembapan maksimum</span><strong>{commodity.max_humidity_percentage}%</strong></div></div>{#if isAdmin}<div class="aksi"><button type="button" onclick={() => (isEditing = true)}>Ubah data</button><button class="bahaya" type="button" onclick={remove}>Hapus komoditas</button></div>{/if}{/if}</article>{/if}</div></div>
<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f4f7f1;
		color: #183126;
		padding: 36px 20px 68px;
	}
	.wadah-halaman {
		max-width: 780px;
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
	.kartu-rincian,.keadaan {
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 28px;
		box-shadow: 0 8px 22px #23472e0a;
	}
	.bilah {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		border-bottom: 1px solid #e8eee6;
		padding-bottom: 22px;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	.bilah h1 {
		margin: 0;
		font-size: clamp(38px,6vw,56px);
		line-height: 1.02;
	}
	.subjudul {
		color: #718077;
	}
	.ikon-tanaman {
		display: grid;
		place-items: center;
		width: 58px;
		height: 58px;
		border-radius: 50%;
		background: #eaf4e9;
		font-size: 29px;
	}
	.fakta {
		display: grid;
		grid-template-columns: repeat(3,1fr);
		gap: 12px;
		padding: 24px 0;
	}
	.fakta div {
		padding: 16px;
		border-radius: 8px;
		background: #f7faf6;
	}
	.fakta span {
		display: block;
		color: #718077;
		font-size: 12px;
	}
	.fakta strong {
		display: block;
		margin-top: 8px;
		color: #39754b;
		font-size: 17px;
	}
	.aksi {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		border-top: 1px solid #e8eee6;
		padding-top: 20px;
	}
	.aksi button {
		border: 1px solid #39754b;
		border-radius: 7px;
		padding: 11px 14px;
		background: #39754b;
		color: #fff;
		font: 700 13px inherit;
		cursor: pointer;
	}
	.aksi .tenang {
		border-color: #d6e1d5;
		background: #fff;
		color: #39754b;
	}
	.aksi .bahaya {
		border-color: #f0c9c5;
		background: #fff0ef;
		color: #a44242;
	}
	.formulir-ubah {
		padding-top: 22px;
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
	input {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		padding: 12px;
		background: #fbfdfb;
		color: #183126;
		font: inherit;
		outline: 0;
	}
	.pesan-berhasil,.pesan-galat {
		margin-top: 18px;
		padding: 12px;
		border-radius: 7px;
		font-size: 13px;
	}
	.pesan-berhasil {
		background: #edf8ed;
		color: #39754b;
	}
	.pesan-galat {
		background: #fff0ef;
		color: #a44242;
	}
	.keadaan {
		text-align: center;
		color: #718077;
	}
	.keadaan.galat {
		color: #a44242;
	}
	@media (max-width:600px) {
		.fakta,.kisi-formulir {
			grid-template-columns: 1fr;
		}
		.bilah {
			align-items: start;
		}
		.aksi {
			flex-wrap: wrap;
		}
	}
</style>
