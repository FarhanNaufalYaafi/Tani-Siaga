<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import {
		deleteProduct,
		completeHarvest,
		getProductById,
		updateProduct,
		type Product,
		type UpdateProductPayload,
	} from '$lib/api/product-api';
	import { showAlert, showConfirm, showInput } from '$lib/services/dialog';

	let currentUser = $state<CurrentUserDto | null>(null);
	let product = $state<Product | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let isDeleting = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let isHarvesting = $state(false);

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

	let form = $state<UpdateProductPayload & { image_url_1?: string }>({
		name: '',
		price: undefined,
		stock: undefined,
		description: '',
		image_url_1: '',
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
				form.image_url_1 = p.image_url?.[0] || '';
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
			if (form.image_url_1) payload.image_url = [form.image_url_1];
			if (!product?.is_pre_order && form.stock !== undefined) {
				payload.stock = Number(form.stock);
			}
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

<div class="edit-wrap">
	<div class="edit-main">
		<a class="back-link" href="/toko">← Kembali ke Dashboard Toko</a>

		{#if isLoading}
			<div class="state">Memuat detail produk...</div>
		{:else if errorMessage && !product}
			<div class="state error">{errorMessage}</div>
		{:else if product}
			<div class="grid-layout">
				<aside class="preview-card">
					<div class="preview-image">
						{#if product.image_url?.[0]}
							<img src={product.image_url[0]} alt={product.name} />
						{:else}
							<span class="ph">🌾</span>
						{/if}
						<span class:po={product.is_pre_order} class="tag">
							{product.is_pre_order ? 'PRE-ORDER' : 'SIAP KIRIM'}
						</span>
					</div>
					<div class="preview-body">
						<p class="eyebrow">PRODUK TOKO</p>
						<h1>{product.name}</h1>
						<p class="shop-link">Toko: {product.shop?.name || 'Toko Saya'}</p>
						<strong class="price-big">{formatPrice(product.price)}</strong>
						{#if product.farmland?.status === 'harvested'}<span class="farmland-status">Lahan sumber sudah panen</span>{/if}
						<div class="stock-info">
							{#if product.is_pre_order}
								<div class="po-info">
									<span>Kuota Pre-Order</span>
									<strong>{product.po_quota_kg} Kg</strong>
								</div>
								<div class="po-info warn">
									<span>Sudah dipesan</span>
									<strong>{product.po_booked_kg} Kg</strong>
								</div>
								<div class="po-info ok">
									<span>Tersisa</span>
									<strong>{Math.max(0, product.po_quota_kg - product.po_booked_kg)} Kg</strong>
								</div>
								{#if product.estimated_harvest_date}
									<p class="harvest">
										Estimasi panen:
										{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(
											new Date(product.estimated_harvest_date),
										)}
									</p>
								{/if}
							{:else}
								<div class="stock-info-inline">
									<span>Stok fisik tercatat</span>
									<strong>{product.stock} {harvestByKg ? 'Kg' : 'unit'}</strong>
								</div>
								{#if product.po_booked_kg > 0}
									<div class="po-info warn"><span>Dikunci untuk pre-order</span><strong>{product.po_booked_kg} Kg</strong></div>
									<div class="po-info ok"><span>Tersedia dibeli langsung</span><strong>{Math.max(0, product.stock - product.po_booked_kg)} Kg</strong></div>
								{/if}
							{/if}
						</div>
						<p class="description-preview">{product.description}</p>
						<a class="view-public" href={`/e-commerce/${product.id}`} target="_blank" rel="noopener noreferrer">Lihat halaman publik ↗</a>
					</div>
				</aside>

				<section class="form-section">
					<div class="page-heading">
						<p class="eyebrow">EDIT PRODUK</p>
						<h1>Perbarui Informasi Produk</h1>
						<p class="subtitle">Ubah data produk sesuai kondisi stok / harga / deskripsi produk.</p>
					</div>

					{#if errorMessage}<div class="alert error">{errorMessage}</div>{/if}
					{#if successMessage}<div class="alert success">{successMessage}</div>{/if}

					<form class="form-card" onsubmit={handleUpdate}>
						<div class="field-grid">
							<label class="full">
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

							<label class="full">
								URL Gambar Utama
								<input bind:value={form.image_url_1} placeholder="https://..." type="url" />
								<small>Masukkan link URL gambar produk (format HTTPS).</small>
							</label>

							<label class="full">
								Deskripsi Produk
								<textarea bind:value={form.description} rows="5" minlength="10" required placeholder="Deskripsikan produk, manfaat, cara penggunaan, dll"></textarea>
								<small>{form.description?.length || 0} karakter</small>
							</label>
						</div>

						<div class="form-actions">
							<a href="/toko" class="cancel">Batal</a>
							<button class="primary" type="submit" disabled={isSaving}>
								{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
							</button>
						</div>
					</form>

					<div class="danger-zone">
						<div>
							<p class="eyebrow danger">ZONA BAHAYA</p>
							<h2>Hapus Produk</h2>
							<p class="subtitle">Produk akan disembunyikan dari semua daftar dan stoknya dikosongkan. Riwayat pesanan tetap tersimpan.</p>
						</div>
						<div class="danger-actions">
							<button class="delete-btn" disabled={isDeleting} onclick={handleDelete}>
								{isDeleting ? 'Menghapus...' : 'Hapus Produk'}
							</button>
						</div>
					</div>
					{#if product.is_pre_order && canHarvestProduct}
						<button class="harvest-btn" type="button" onclick={handleHarvest} disabled={isHarvesting}>
							{isHarvesting ? 'Memproses panen...' : 'Panen Hari Ini'}
						</button>
					{:else if product.is_pre_order && product.farmland?.farmer_group_id}
						<p class="harvest-note">Panen lahan kelompok hanya dapat dicatat oleh ketua kelompok.</p>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>

<style>
	.edit-main {
		max-width: 1180px;
		margin: auto;
		padding: 36px 28px 80px;
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
		padding: 50px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		color: #718077;
	}
	.state.error { background: #fff0ef; color: #a44242; }

	.grid-layout {
		display: grid;
		grid-template-columns: minmax(320px, 0.9fr) 1.2fr;
		gap: 28px;
		align-items: flex-start;
	}

	.preview-card {
		position: sticky;
		top: 20px;
		border: 1px solid #d6e1d5;
		border-radius: 14px;
		background: #fff;
		overflow: hidden;
		box-shadow: 0 8px 24px #23472e0c;
	}
	.preview-image {
		position: relative;
		display: grid;
		place-items: center;
		height: 240px;
		background: #dcebd8;
	}
	.preview-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ph {
		font-size: 80px;
	}
	.tag {
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
	.tag.po { background: #a8762e; }
	.preview-body {
		padding: 26px 26px 28px;
	}
	.eyebrow {
		margin: 0 0 10px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.eyebrow.danger { color: #a44242; }
	.preview-body h1 {
		margin: 0;
		font: 600 28px/1.1 'Fraunces', Georgia, serif;
	}
	.shop-link {
		margin: 8px 0 16px;
		color: #718077;
		font-size: 13px;
	}
	.preview-body .farmland-status { display: block; width: fit-content; margin: 8px 0 14px; border-radius: 999px; background: #eaf4e9; color: #39754b; padding: 6px 9px; font-size: 10px; font-weight: 800; }
	.price-big {
		display: inline-block;
		color: #39754b;
		font: 800 32px 'DM Sans', sans-serif;
	}
	.stock-info {
		margin: 18px 0 16px;
		display: grid;
		gap: 8px;
	}
	.po-info, .stock-info-inline {
		display: flex;
		justify-content: space-between;
		padding: 10px 14px;
		border-radius: 7px;
		background: #f4faf2;
		font-size: 13px;
	}
	.po-info span, .stock-info-inline span { color: #5b6e62; font-weight: 600; }
	.po-info strong { background: #eaf4e9; color: #183126; }
	.po-info.warn { background: #fff8e8; }
	.po-info.ok { background: #edf8ed; }
	.harvest {
		margin: 6px 0 0;
		padding: 10px 14px;
		border-radius: 7px;
		background: #f9f3e8;
		color: #755b1f;
		font-size: 12px;
		font-weight: 700;
	}
	.description-preview {
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
	.view-public {
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
	.view-public:hover { background: #39754b; }

	.form-section {
		display: grid;
		gap: 20px;
	}
	.page-heading { margin-bottom: 4px; }
	.page-heading h1 {
		margin: 0;
		font: 600 clamp(28px, 4vw, 42px)/1 'Fraunces', Georgia, serif;
	}
	.subtitle {
		margin: 12px 0 0;
		color: #718077;
		line-height: 1.55;
	}

	.alert {
		padding: 14px 18px;
		border-radius: 8px;
		margin-bottom: 6px;
		font-size: 14px;
		font-weight: 600;
	}
	.alert.error { background: #fff0ef; color: #a44242; border: 1px solid #e6b8b3; }
	.alert.success { background: #edf8ed; color: #39754b; border: 1px solid #a9c9aa; }

	.form-card {
		display: grid;
		gap: 22px;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		padding: 30px;
		box-shadow: 0 8px 22px #23472e0f;
	}
	.field-grid {
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
	label small {
		color: #718077;
		font-weight: 500;
		font-size: 12px;
	}
	textarea { resize: vertical; }

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 14px;
		padding-top: 6px;
	}
	.cancel {
		color: #385540;
		text-decoration: none;
		font-weight: 700;
		font-size: 14px;
		padding: 14px 0;
	}
	.primary {
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
	.primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.harvest-btn {
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
	.farmland-status { display: inline-block; border-radius: 999px; background: #fff0dc; color: #875c22; padding: 6px 9px; font-size: 10px; font-weight: 800; }
	.harvest-note { color: #876321; font-size: 12px; line-height: 1.5; }
	.harvest-btn:disabled { opacity: .6; cursor: wait; }

	.danger-zone {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 24px;
		padding: 26px 30px;
		border: 1px solid #e6b8b3;
		border-radius: 12px;
		background: #fff6f5;
	}
	.danger-zone h2 {
		margin: 0;
		font: 700 22px 'DM Sans', sans-serif;
		color: #a44242;
	}
	.danger-zone .subtitle {
		margin: 8px 0 0;
		color: #805252;
		font-size: 13px;
	}
	.danger-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.delete-btn {
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
	.delete-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	@media (max-width: 1000px) {
		.grid-layout { grid-template-columns: 1fr; }
		.preview-card { position: static; }
	}
	@media (max-width: 760px) {
		.field-grid { grid-template-columns: 1fr; }
		label.full { grid-column: span 1; }
		.danger-zone { flex-direction: column; align-items: stretch; }
	}
</style>
