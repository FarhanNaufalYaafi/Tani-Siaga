<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createShop, getMyShop, type CreateShopPayload } from '$lib/api/shop-api';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { uploadImage } from '$lib/api/media-api';

	let currentUser = $state<CurrentUserDto | null>(null);
	let isChecking = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let selectedImage = $state<File | null>(null);
	let imagePreviewUrl = $state('');

	let form = $state<CreateShopPayload>({
		name: '',
		description: '',
		location: '',
		phone_number: '',
	});

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
		} catch {
			await goto('/signin');
			return;
		}
		try {
			const existing = await getMyShop();
			if (existing.has_shop) {
				successMessage = 'Anda sudah memiliki toko. Mengalihkan ke dashboard toko...';
				setTimeout(() => goto('/toko'), 1200);
				return;
			}
		} catch {
			// Lanjut create jika error (misal 404 not found shop)
		} finally {
			isChecking = false;
		}
	});

	function handleImageSelection(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] || null;
		if (!file) return;
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			errorMessage = 'Foto toko harus berformat JPG, PNG, atau WebP.';
			input.value = '';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			errorMessage = 'Ukuran foto toko maksimal 5 MB.';
			input.value = '';
			return;
		}
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
		selectedImage = file;
		imagePreviewUrl = URL.createObjectURL(file);
		errorMessage = '';
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		isSaving = true;
		errorMessage = '';
		successMessage = '';
		try {
			const profile_image_url = selectedImage ? (await uploadImage(selectedImage, 'profile')).url : undefined;
			await createShop({ ...form, ...(profile_image_url ? { profile_image_url } : {}) });
			successMessage = 'Toko berhasil dibuat! Mengalihkan ke dashboard toko...';
			setTimeout(() => goto('/toko'), 1400);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal membuat toko. Silakan coba lagi.';
		} finally {
			isSaving = false;
		}
	}

	onDestroy(() => {
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
	});
</script>

<svelte:head><title>Buat Toko | Tani Siaga</title></svelte:head>

<div class="bungkus-buat">
	<div class="utama-buat">
		<a class="tautan-kembali" href="/toko">← Kembali ke Dashboard Toko</a>

		{#if isChecking}
			<div class="keadaan">Memeriksa data toko...</div>
		{:else}
			<div class="judul-halaman">
				<p class="label-kecil">PENDAFTARAN TOKO</p>
				<h1 class="judul">Buat Toko Pertanianmu</h1>
				<p class="subjudul">Lengkapi profil toko agar pembeli dapat mengenal hasil panen dan lokasimu.</p>
			</div>

			{#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
			{#if successMessage}<div class="peringatan berhasil">{successMessage}</div>{/if}

			<form class="kartu-formulir" onsubmit={handleSubmit}>
				<div class="kisi-bidang">
					<label class="penuh">
						Foto Profil Toko (opsional)
						<span class="pemilih-foto"><input type="file" accept="image/jpeg,image/png,image/webp" onchange={handleImageSelection} /><span class="tombol-pemilih-foto">Pilih foto</span><span class="nama-pemilih-foto">{selectedImage?.name || 'Belum ada foto'}</span></span>
						<small>JPG, PNG, atau WebP, maksimal 5 MB.</small>
						{#if imagePreviewUrl}<img class="pratinjau-gambar-toko" src={imagePreviewUrl} alt="Preview foto toko" />{/if}
					</label>
					<label class="penuh">
						Nama Toko
						<input
							bind:value={form.name}
							required
							minlength="3"
							maxlength="100"
							placeholder="Contoh: Tani Makmur Sejahtera"
						/>
						<small>Minimal 3 karakter, maksimal 100 karakter.</small>
					</label>

					<label>
						Nomor Telepon Toko
						<input
							bind:value={form.phone_number}
							required
							type="tel"
							placeholder="Contoh: 081234567890"
						/>
						<small>Nomor telepon aktif (WhatsApp) untuk dihubungi pembeli.</small>
					</label>

					<label>
						Lokasi Toko / Alamat
						<input
							bind:value={form.location}
							required
							minlength="10"
							maxlength="500"
							placeholder="Contoh: Jl. Raya Merapi No. 42, Sleman, Yogyakarta"
						/>
						<small>Alamat lengkap penjemputan / lokasi toko.</small>
					</label>

					<label class="penuh">
						Deskripsi Toko
						<textarea
							bind:value={form.description}
							required
							minlength="20"
							maxlength="1500"
							rows="6"
							placeholder="Ceritakan tentang toko dan hasil panen Anda, misalnya jenis komoditas unggulan, cara budidaya, atau jadwal ketersediaan panen..."
						></textarea>
						<small>{form.description.length} / 1500 karakter (minimal 20).</small>
					</label>
				</div>

				<div class="kiat">
					<p class="label-kecil">TIPS PEMBUATAN TOKO</p>
					<ul>
						<li>Gunakan nama toko yang mudah diingat dan merepresentasikan identitas petani / kelompok tani.</li>
						<li>Isi deskripsi dengan jelas: jenis produk unggulan, musim tanam, atau cara order / penjemputan.</li>
						<li>Pastikan nomor telepon aktif via WhatsApp untuk memudahkan komunikasi dengan pembeli.</li>
					</ul>
				</div>

				<div class="aksi-formulir">
					<a href="/toko" class="batal">Batal</a>
					<button class="utama" type="submit" disabled={isSaving}>
						{isSaving ? 'Membuat toko...' : 'Buat Toko ↗'}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	.bungkus-buat {
		flex: 1;
		color: #183126;
	}
	.utama-buat {
		max-width: 950px;
		margin: auto;
		padding: 24px 28px 70px;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 26px;
		color: #39754b;
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
	}
	.keadaan {
		padding: 48px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		color: #718077;
	}
	.judul-halaman {
		margin-bottom: 28px;
	}
	.label-kecil {
		margin: 0 0 10px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.judul-halaman h1 {
		margin: 0;
		font: 600 clamp(34px, 5vw, 52px)/1 'Fraunces', Georgia, serif;
	}
	.subjudul {
		max-width: 640px;
		margin: 16px 0 0;
		color: #718077;
		line-height: 1.6;
	}
	.peringatan {
		padding: 14px 18px;
		border-radius: 8px;
		margin-bottom: 20px;
		font-size: 14px;
		font-weight: 600;
	}
	.peringatan.galat {
		background: #fff0ef;
		color: #a44242;
		border: 1px solid #e6b8b3;
	}
	.peringatan.berhasil {
		background: #edf8ed;
		color: #39754b;
		border: 1px solid #a9c9aa;
	}
	.kartu-formulir {
		display: grid;
		gap: 26px;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		padding: 34px;
		box-shadow: 0 8px 22px #23472e0f;
	}
	.kisi-bidang {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 20px;
	}
	label {
		display: grid;
		gap: 8px;
		color: #385540;
		font-size: 13px;
		font-weight: 700;
	}
	label.penuh {
		grid-column: span 2;
	}
	input, textarea {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fbfdfb;
		color: #183126;
		padding: 12px 14px;
		font: inherit;
		font-weight: 400;
		outline: none;
	}
	input:focus, textarea:focus {
		border-color: #5c9568;
		box-shadow: 0 0 0 3px #5c95681c;
	}
	textarea {
		resize: vertical;
		min-height: 130px;
	}
	label small {
		color: #718077;
		font-weight: 500;
		font-size: 12px;
	}
	.kiat {
		padding: 22px 24px;
		border: 1px solid #cfe2cd;
		border-radius: 10px;
		background: #f4faf2;
	}
	.kiat ul {
		margin: 12px 0 0;
		padding-left: 20px;
		display: grid;
		gap: 8px;
		color: #385540;
		font-size: 13px;
		line-height: 1.55;
	}
	.aksi-formulir {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 14px;
		padding-top: 6px;
	}
	.batal {
		color: #385540;
		text-decoration: none;
		font-weight: 700;
		font-size: 14px;
	}
	.utama {
		padding: 14px 22px;
		border-radius: 8px;
		background: #39754b;
		color: #fff;
		border: none;
		font: inherit;
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
		box-shadow: 0 8px 18px #39754b26;
	}
	.utama:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	@media (max-width: 760px) {
		.kisi-bidang {
			grid-template-columns: 1fr;
		}
		label.penuh {
			grid-column: span 1;
		}
	}
	.pratinjau-gambar-toko {
		width: 100px;
		height: 100px;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		object-fit: cover;
	}
	.pemilih-foto {
		display: flex;
		width: fit-content;
		align-items: center;
		gap: 10px;
	}
	.pemilih-foto input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}
	.tombol-pemilih-foto {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 36px;
		border: 1px solid #39754b;
		border-radius: 7px;
		background: #edf8ed;
		color: #39754b;
		padding: 8px 14px;
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
		transition: background .15s, color .15s;
	}
	.pemilih-foto:hover .tombol-pemilih-foto {
		background: #39754b;
		color: #fff;
	}
	.pemilih-foto:focus-within .tombol-pemilih-foto {
		outline: 3px solid #5c95684d;
		outline-offset: 2px;
	}
	.nama-pemilih-foto {
		color: #718077;
		font-size: 11px;
		font-weight: 400;
	}
</style>
