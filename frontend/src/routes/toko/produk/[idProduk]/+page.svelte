<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { getMyShop } from '$lib/api/shop-api';
	import {
		deleteProduct,
		completeHarvest,
		getProductById,
		updateProduct,
		type Product,
		type UpdateProductPayload,
	} from '$lib/api/product-api';
	import { showAlert, showConfirm, showInput } from '$lib/services/dialog';
	import { uploadImages } from '$lib/api/media-api';

	let currentUser = $state<CurrentUserDto | null>(null);
	let product = $state<Product | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let isDeleting = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let isHarvesting = $state(false);
	let selectedImages = $state<File[]>([]);
	let imagePreviewUrl = $state('');

	let productId = $derived(parseInt($page.params.idProduk || '0', 10));
	let harvestByKg = $derived(Boolean(product?.is_pre_order || product?.farmland_id));
	let canHarvestProduct = $derived.by(() => {
		if (!product?.is_pre_order || !product.farmland) return false;
		if (!product.farmland.farmer_group_id) return true;
		return currentUser?.role === 'admin' || (
			currentUser?.role === 'group_leader' &&
			Number(currentUser.farmer_group_id) === Number(product.farmland.farmer_group_id)
		);
	});

	let form = $state<UpdateProductPayload>({
		name: '',
		price: undefined,
		stock: undefined,
		description: '',
		po_quota_kg: undefined,
	});

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
		} catch {
			await goto('/signin');
			return;
		}
		if (!productId || Number.isNaN(productId)) {
			errorMessage = 'ID produk tidak valid.';
			isLoading = false;
			return;
		}
		const shopResponse = await getMyShop().catch(() => null);
		if (shopResponse?.shop?.banned_until && new Date(shopResponse.shop.banned_until).getTime() > Date.now()) {
			await goto('/toko', { replaceState: true });
			return;
		}
		await loadProduct();
	});

	async function loadProduct() {
		isLoading = true;
		errorMessage = '';
		return getProductById(productId)
			.then((p) => {
				product = p;
				form.name = p.name;
				form.price = p.price;
				form.stock = p.stock;
				form.description = p.description;
				form.po_quota_kg = p.po_quota_kg;
			})
			.catch((err) => {
				errorMessage = err.message || 'Gagal memuat detail produk.';
			})
			.finally(() => {
				isLoading = false;
			});
	}

	function formatPrice(value: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function handleImageSelection(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files || []);
		if (files.length > 5) {
			errorMessage = 'Pilih maksimal 5 gambar produk.';
			input.value = '';
			return;
		}
		if (files.some((file) => file.size > 5 * 1024 * 1024)) {
			errorMessage = 'Ukuran setiap gambar maksimal 5 MB.';
			input.value = '';
			return;
		}
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
		selectedImages = files;
		imagePreviewUrl = files.length ? URL.createObjectURL(files[0]) : '';
		errorMessage = '';
	}

	async function handleUpdate(event: SubmitEvent) {
		event.preventDefault();
		isSaving = true;
		errorMessage = '';
		successMessage = '';
		try {
			const payload: UpdateProductPayload = {
				name: form.name,
				price: Number(form.price),
				description: form.description,
			};
			if (selectedImages.length) payload.image_url = await uploadImages(selectedImages, 'product');
			if (!product?.is_pre_order && form.stock !== undefined) {
				payload.stock = Number(form.stock);
			}

			onDestroy(() => {
				if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
			});
			if (product?.is_pre_order && form.po_quota_kg !== undefined) {
				payload.po_quota_kg = Number(form.po_quota_kg);
			}
			const updated = await updateProduct(productId, payload);
			product = updated;
			successMessage = 'Produk berhasil diperbarui!';
			setTimeout(() => (successMessage = ''), 3500);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memperbarui produk.';
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete() {
		if (!product) return;
		const confirmed = await showConfirm(
			`Produk "${product.name}" akan disembunyikan dari daftar toko dan stoknya dikosongkan. Riwayat pesanan tetap tersimpan.`,
			{ title: 'Hapus produk?', confirmLabel: 'Hapus produk', tone: 'error' },
		);
		if (!confirmed) return;
		isDeleting = true;
		errorMessage = '';
		try {
			await deleteProduct(productId);
			successMessage = 'Produk disembunyikan dari daftar toko. Mengalihkan kembali...';
			setTimeout(() => goto('/toko'), 1300);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal menghapus produk.';
		} finally {
			isDeleting = false;
		}
	}

	async function handleHarvest() {
		if (!product?.is_pre_order) return;
		const harvestInput = await showInput({
			title: 'Konfirmasi panen',
			message: 'Pembeli yang sudah booking akan diberi tahu saat hasil panen dicatat.',
			input: { label: 'Hasil panen aktual (Kg)', type: 'number', min: product.po_booked_kg, step: 1, required: true },
			confirmLabel: 'Konfirmasi panen',
		});
		if (harvestInput === null) return;
		const yieldKg = Number(harvestInput);
		if (!Number.isFinite(yieldKg) || yieldKg < product.po_booked_kg) {
			await showAlert(`Hasil panen minimal ${product.po_booked_kg} Kg.`, { title: 'Hasil panen tidak valid', tone: 'error' });
			return;
		}
		isHarvesting = true;
		errorMessage = '';
		try {
			product = await completeHarvest(productId, yieldKg);
			form.stock = product.stock;
			successMessage = 'Panen dicatat. Pembeli pre-order akan menerima notifikasi.';
		} catch (error: any) {
			await showAlert(error.message || 'Gagal mencatat panen.', { title: 'Panen gagal dicatat', tone: 'error' });
		} finally {
			isHarvesting = false;
		}
	}
</script>

<svelte:head><title>Kelola Produk | Tani Siaga</title></svelte:head>

<div class="bungkus-ubah">
	<div class="utama-ubah">
		<a class="tautan-kembali" href="/toko">← Kembali ke Dashboard Toko</a>

		{#if isLoading}
			<div class="keadaan">Memuat detail produk...</div>
		{:else if errorMessage && !product}
			<div class="keadaan galat">{errorMessage}</div>
		{:else if product}
			<div class="tata-kisi">
				<aside class="kartu-pratinjau">
					<div class="gambar-pratinjau">
						{#if imagePreviewUrl || product.image_url?.[0]}
							<img src={imagePreviewUrl || product.image_url?.[0]} alt={product.name} />
						{:else}
							<span class="petunjuk">🌾</span>
						{/if}
						<span class:pra-pesan={product.is_pre_order} class="label">
							{product.is_pre_order ? 'PRE-ORDER' : 'SIAP KIRIM'}
						</span>
					</div>
					<div class="isi-pratinjau">
						<p class="label-kecil">PRODUK TOKO</p>
						<h1 class="judul">{product.name}</h1>
						<p class="tautan-toko">Toko: {product.shop?.name || 'Toko Saya'}</p>
						<strong class="besar-harga">{formatPrice(product.price)}</strong>
						{#if product.farmland?.status === 'harvested'}<span class="status-lahan">Lahan sumber sudah panen</span>{/if}
						<div class="informasi-stok">
							{#if product.is_pre_order}
								<div class="informasi-pra-pesan">
									<span>Kuota Pre-Order</span>
									<strong>{product.po_quota_kg} Kg</strong>
								</div>
								<div class="informasi-pra-pesan peringatan">
									<span>Sudah dipesan</span>
									<strong>{product.po_booked_kg} Kg</strong>
								</div>
								<div class="informasi-pra-pesan berhasil">
									<span>Tersisa</span>
									<strong>{Math.max(0, product.po_quota_kg - product.po_booked_kg)} Kg</strong>
								</div>
								{#if product.estimated_harvest_date}
									<p class="panen">
										Estimasi panen:
										{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(
											new Date(product.estimated_harvest_date),
										)}
									</p>
								{/if}
							{:else}
								<div class="sebaris-informasi-stok">
									<span>Stok fisik tercatat</span>
									<strong>{product.stock} {harvestByKg ? 'Kg' : 'unit'}</strong>
								</div>
								{#if product.po_booked_kg > 0}
									<div class="informasi-pra-pesan peringatan"><span>Dikunci untuk pre-order</span><strong>{product.po_booked_kg} Kg</strong></div>
									<div class="informasi-pra-pesan berhasil"><span>Tersedia dibeli langsung</span><strong>{Math.max(0, product.stock - product.po_booked_kg)} Kg</strong></div>
								{/if}
							{/if}
						</div>
						<p class="pratinjau-deskripsi">{product.description}</p>
						<a class="publik-lihat" href={`/e-commerce/${product.id}`} target="_blank" rel="noopener noreferrer">Lihat halaman publik ↗</a>
					</div>
				</aside>

				<section class="bagian-formulir">
					<div class="judul-halaman">
						<p class="label-kecil">EDIT PRODUK</p>
						<h1 class="judul">Perbarui Informasi Produk</h1>
						<p class="subjudul">Ubah data produk sesuai kondisi stok / harga / deskripsi produk.</p>
					</div>

					{#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
					{#if successMessage}<div class="peringatan berhasil">{successMessage}</div>{/if}

					<form class="kartu-formulir" onsubmit={handleUpdate}>
						<div class="kisi-bidang">
							<label class="penuh">
								Nama Produk
								<input bind:value={form.name} required minlength="3" placeholder="Nama produk" />
							</label>

							<label>
								Harga (Rp)
								<input type="number" bind:value={form.price} required min="1" step="1" placeholder="Contoh: 15000" />
								<small>Harga per Kg / per unit</small>
							</label>

							{#if !product.is_pre_order}
								<label>
									Stok Ready
									<input
										type="number"
										bind:value={form.stock}
										min="0"
										step="1"
										placeholder="Stok tersedia"
									/>
									<small>
										{#if harvestByKg}Stok total hasil panen dalam Kg; {#if product.po_booked_kg > 0}{product.po_booked_kg} Kg masih dikunci untuk pre-order.{:else}tidak ada stok yang sedang dikunci.{/if}{:else}Stok ready dalam unit, tidak bisa di bawah nol.{/if}
									</small>
								</label>
							{:else}
								<label>
									Kuota Pre-Order (Kg)
									<input
										type="number"
										bind:value={form.po_quota_kg}
										min={product.po_booked_kg}
										step="1"
										placeholder="Total kuota yang ditawarkan"
									/>
									<small>Minimal {product.po_booked_kg} Kg (sudah dipesan)</small>
								</label>
							{/if}

							<label class="penuh">
								Foto Produk
								<span class="pemilih-foto"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange={handleImageSelection} /><span class="tombol-pemilih-foto">Pilih foto</span><span class="nama-pemilih-foto">{selectedImages.length ? `${selectedImages.length} foto dipilih` : 'Foto saat ini tetap dipakai'}</span></span>
								<small>Pilih maksimal 5 foto baru untuk menggantikan foto lama. JPG, PNG, atau WebP, maksimal 5 MB per foto.{selectedImages.length ? ` ${selectedImages.length} foto dipilih.` : ''}</small>
							</label>

							<label class="penuh">
								Deskripsi Produk
								<textarea bind:value={form.description} rows="5" minlength="10" required placeholder="Deskripsikan produk, manfaat, cara penggunaan, dll"></textarea>
								<small>{form.description?.length || 0} karakter</small>
							</label>
						</div>

						<div class="aksi-formulir">
							<a href="/toko" class="batal">Batal</a>
							<button class="utama" type="submit" disabled={isSaving}>
								{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
							</button>
						</div>
					</form>

					<div class="zona-bahaya">
						<div>
							<p class="label-kecil bahaya">ZONA BAHAYA</p>
							<h2>Hapus Produk</h2>
							<p class="subjudul">Produk akan disembunyikan dari semua daftar dan stoknya dikosongkan. Riwayat pesanan tetap tersimpan.</p>
						</div>
						<div class="aksi-bahaya">
							<button class="tombol-hapus" disabled={isDeleting} onclick={handleDelete}>
								{isDeleting ? 'Menghapus...' : 'Hapus Produk'}
							</button>
						</div>
					</div>
					{#if product.is_pre_order && canHarvestProduct}
						<button class="tombol-panen" type="button" onclick={handleHarvest} disabled={isHarvesting}>
							{isHarvesting ? 'Memproses panen...' : 'Panen Hari Ini'}
						</button>
					{:else if product.is_pre_order && product.farmland?.farmer_group_id}
						<p class="catatan-panen">Panen lahan kelompok hanya dapat dicatat oleh ketua kelompok.</p>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>

<style>
	.utama-ubah {
		width: 100%;
		max-width: 1180px;
		margin: auto;
		padding: 36px 28px 80px;
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
		padding: 50px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		color: #718077;
	}
	.keadaan.galat {
		background: #fff0ef;
		color: #a44242;
	}
	.tata-kisi {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr);
		gap: 28px;
		align-items: flex-start;
	}
	.kartu-pratinjau, .bagian-formulir {
		min-width: 0;
	}
	.kartu-pratinjau {
		position: static;
		border: 1px solid #d6e1d5;
		border-radius: 14px;
		background: #fff;
		overflow: hidden;
		box-shadow: 0 8px 24px #23472e0c;
	}
	.gambar-pratinjau {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 1 / 1;
		height: auto;
		overflow: hidden;
		background: #dcebd8;
	}
	.gambar-pratinjau img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}
	.petunjuk {
		font-size: 80px;
	}
	.label {
		position: absolute;
		top: 14px;
		left: 14px;
		border-radius: 6px;
		background: #183126;
		color: #fff;
		padding: 7px 10px;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
	}
	.label.pra-pesan {
		background: #a8762e;
	}
	.isi-pratinjau {
		padding: 26px 26px 28px;
	}
	.label-kecil {
		margin: 0 0 10px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.label-kecil.bahaya {
		color: #a44242;
	}
	.isi-pratinjau h1 {
		margin: 0;
		font: 600 28px/1.1 'Fraunces', Georgia, serif;
	}
	.tautan-toko {
		margin: 8px 0 16px;
		color: #718077;
		font-size: 13px;
	}
	.isi-pratinjau .status-lahan {
		display: block;
		width: fit-content;
		margin: 8px 0 14px;
		border-radius: 999px;
		background: #eaf4e9;
		color: #39754b;
		padding: 6px 9px;
		font-size: 10px;
		font-weight: 800;
	}
	.besar-harga {
		display: inline-block;
		color: #39754b;
		font: 800 32px 'DM Sans', sans-serif;
	}
	.informasi-stok {
		margin: 18px 0 16px;
		display: grid;
		gap: 8px;
	}
	.informasi-pra-pesan, .sebaris-informasi-stok {
		display: flex;
		justify-content: space-between;
		padding: 10px 14px;
		border-radius: 7px;
		background: #f4faf2;
		font-size: 13px;
	}
	.informasi-pra-pesan span, .sebaris-informasi-stok span {
		color: #5b6e62;
		font-weight: 600;
	}
	.informasi-pra-pesan strong {
		background: #eaf4e9;
		color: #183126;
	}
	.informasi-pra-pesan.peringatan {
		background: #fff8e8;
	}
	.informasi-pra-pesan.berhasil {
		background: #edf8ed;
	}
	.panen {
		margin: 6px 0 0;
		padding: 10px 14px;
		border-radius: 7px;
		background: #f9f3e8;
		color: #755b1f;
		font-size: 12px;
		font-weight: 700;
	}
	.pratinjau-deskripsi {
		margin: 0 0 18px;
		padding: 14px;
		background: #fbfdfb;
		border: 1px dashed #d6e1d5;
		border-radius: 8px;
		color: #385540;
		font-size: 13px;
		line-height: 1.6;
		white-space: pre-wrap;
	}
	.publik-lihat {
		display: block;
		text-align: center;
		padding: 11px 14px;
		border-radius: 8px;
		background: #183126;
		color: #fff;
		text-decoration: none;
		font-size: 12px;
		font-weight: 700;
	}
	.publik-lihat:hover {
		background: #39754b;
	}
	.bagian-formulir {
		display: grid;
		gap: 20px;
	}
	.judul-halaman {
		margin-bottom: 4px;
	}
	.judul-halaman h1 {
		margin: 0;
		font: 600 clamp(28px, 4vw, 42px)/1 'Fraunces', Georgia, serif;
	}
	.subjudul {
		margin: 12px 0 0;
		color: #718077;
		line-height: 1.55;
	}
	.peringatan {
		padding: 14px 18px;
		border-radius: 8px;
		margin-bottom: 6px;
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
		gap: 22px;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		padding: 30px;
		box-shadow: 0 8px 22px #23472e0f;
	}
	.kisi-bidang {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 18px;
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
	label small {
		color: #718077;
		font-weight: 500;
		font-size: 12px;
	}
	textarea {
		resize: vertical;
	}
	.aksi-formulir {
		display: flex;
		justify-content: flex-end;
		gap: 14px;
		padding-top: 6px;
	}
	.batal {
		color: #385540;
		text-decoration: none;
		font-weight: 700;
		font-size: 14px;
		padding: 14px 0;
	}
	.utama {
		padding: 13px 22px;
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
		opacity: 0.6;
		cursor: not-allowed;
	}
	.tombol-panen {
		width: 100%;
		margin-top: 14px;
		border: 1px solid #c9973e;
		border-radius: 8px;
		background: #fff7e6;
		color: #946b22;
		padding: 13px 18px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.status-lahan {
		display: inline-block;
		border-radius: 999px;
		background: #fff0dc;
		color: #875c22;
		padding: 6px 9px;
		font-size: 10px;
		font-weight: 800;
	}
	.catatan-panen {
		color: #876321;
		font-size: 12px;
		line-height: 1.5;
	}
	.tombol-panen:disabled {
		opacity: .6;
		cursor: wait;
	}
	.zona-bahaya {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 24px;
		padding: 26px 30px;
		border: 1px solid #e6b8b3;
		border-radius: 12px;
		background: #fff6f5;
	}
	.zona-bahaya h2 {
		margin: 0;
		font: 700 22px 'DM Sans', sans-serif;
		color: #a44242;
	}
	.zona-bahaya .subjudul {
		margin: 8px 0 0;
		color: #805252;
		font-size: 13px;
	}
	.aksi-bahaya {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.tombol-hapus {
		padding: 13px 22px;
		border-radius: 8px;
		background: #a44242;
		color: #fff;
		border: none;
		font: inherit;
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
		box-shadow: 0 6px 16px #a4424222;
	}
	.tombol-hapus:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	@media (max-width: 1000px) {
		.tata-kisi {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 760px) {
		.kisi-bidang {
			grid-template-columns: 1fr;
		}
		label.penuh {
			grid-column: span 1;
		}
		.zona-bahaya {
			flex-direction: column;
			align-items: stretch;
		}
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
