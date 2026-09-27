<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createShop, getMyShop, type CreateShopPayload } from '$lib/api/shop-api';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';

	let currentUser = $state<CurrentUserDto | null>(null);
	let isChecking = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');

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

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		isSaving = true;
		errorMessage = '';
		successMessage = '';
		try {
			await createShop({ ...form });
			successMessage = 'Toko berhasil dibuat! Mengalihkan ke dashboard toko...';
			setTimeout(() => goto('/toko'), 1400);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal membuat toko. Silakan coba lagi.';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head><title>Buat Toko | Tani Siaga</title></svelte:head>

<div class="create-wrap">
	<div class="create-main">
		<a class="back-link" href="/toko">← Kembali ke Dashboard Toko</a>

		{#if isChecking}
			<div class="state">Memeriksa data toko...</div>
		{:else}
			<div class="page-heading">
				<p class="eyebrow">PENDAFTARAN TOKO</p>
				<h1>Buat Toko Pertanianmu</h1>
				<p class="subtitle">Lengkapi profil toko agar pembeli dapat mengenal hasil panen dan lokasimu.</p>
			</div>

			{#if errorMessage}<div class="alert error">{errorMessage}</div>{/if}
			{#if successMessage}<div class="alert success">{successMessage}</div>{/if}

			<form class="form-card" onsubmit={handleSubmit}>
				<div class="field-grid">
					<label class="full">
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

					<label class="full">
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

				<div class="tips">
					<p class="eyebrow">TIPS PEMBUATAN TOKO</p>
					<ul>
						<li>Gunakan nama toko yang mudah diingat dan merepresentasikan identitas petani / kelompok tani.</li>
						<li>Isi deskripsi dengan jelas: jenis produk unggulan, musim tanam, atau cara order / penjemputan.</li>
						<li>Pastikan nomor telepon aktif via WhatsApp untuk memudahkan komunikasi dengan pembeli.</li>
					</ul>
				</div>

				<div class="form-actions">
					<a href="/toko" class="cancel">Batal</a>
					<button class="primary" type="submit" disabled={isSaving}>
						{isSaving ? 'Membuat toko...' : 'Buat Toko ↗'}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	.create-wrap { flex: 1; color: #183126; }

	.create-main {
		max-width: 950px;
		margin: auto;
		padding: 24px 28px 70px;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 26px;
		color: #39754b;
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
	}

	.state {
		padding: 48px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		color: #718077;
	}

	.page-heading { margin-bottom: 28px; }
	.eyebrow {
		margin: 0 0 10px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.page-heading h1 {
		margin: 0;
		font: 600 clamp(34px, 5vw, 52px)/1 'Fraunces', Georgia, serif;
	}
	.subtitle {
		max-width: 640px;
		margin: 16px 0 0;
		color: #718077;
		line-height: 1.6;
	}

	.alert {
		padding: 14px 18px;
		border-radius: 8px;
		margin-bottom: 20px;
		font-size: 14px;
		font-weight: 600;
	}
	.alert.error { background: #fff0ef; color: #a44242; border: 1px solid #e6b8b3; }
	.alert.success { background: #edf8ed; color: #39754b; border: 1px solid #a9c9aa; }

	.form-card {
		display: grid;
		gap: 26px;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		padding: 34px;
		box-shadow: 0 8px 22px #23472e0f;
	}
	.field-grid {
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
	label.full { grid-column: span 2; }
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
	textarea { resize: vertical; min-height: 130px; }
	label small {
		color: #718077;
		font-weight: 500;
		font-size: 12px;
	}

	.tips {
		padding: 22px 24px;
		border: 1px solid #cfe2cd;
		border-radius: 10px;
		background: #f4faf2;
	}
	.tips ul {
		margin: 12px 0 0;
		padding-left: 20px;
		display: grid;
		gap: 8px;
		color: #385540;
		font-size: 13px;
		line-height: 1.55;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 14px;
		padding-top: 6px;
	}
	.cancel {
		color: #385540;
		text-decoration: none;
		font-weight: 700;
		font-size: 14px;
	}
	.primary {
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
	.primary:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	@media (max-width: 760px) {
		.field-grid { grid-template-columns: 1fr; }
		label.full { grid-column: span 1; }
	}
</style>
