<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { createProduct, type CreateProductPayload } from '$lib/api/product-api';
	import { getMyFarmlands, type Farmland } from '$lib/api/farmland-api';
	import { getMyShop, type ShopResponse } from '$lib/api/shop-api';

	const SELLER_ROLES = ['farmer', 'individual_farmer', 'group_leader', 'admin'];

	let currentUser = $state<CurrentUserDto | null>(null);
	let hasShop = $state<boolean | null>(null);
	let shopInfo = $state<ShopResponse['shop']>(null);
	let isSeller = $state<boolean | null>(null);
	let farmlands = $state<Farmland[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let loadFarmlandError = $state('');

	let isPreOrder = $state(false);
	let eligibleFarmlands = $derived(farmlands.filter((farmland) => {
		if (farmland.status === 'harvested') return false;
		if (!farmland.farmer_group_id) return true;
		return currentUser?.role === 'admin' || (
			currentUser?.role === 'group_leader' &&
			Number(currentUser.farmer_group_id) === Number(farmland.farmer_group_id)
		);
	}));

	let form = $state<{
		name: string;
		price: number | undefined;
		stock: number | undefined;
		description: string;
		image_url_1: string;
		farmland_id: number | '';
		po_quota_kg: number | undefined;
	}>({
		name: '',
		price: undefined,
		stock: undefined,
		description: '',
		image_url_1: '',
		farmland_id: '',
		po_quota_kg: undefined,
	});

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
		} catch {
			await goto('/signin');
			return;
		}

		isSeller = currentUser?.role ? SELLER_ROLES.includes(currentUser.role.toLowerCase()) : false;

		try {
			const shopRes = await getMyShop();
			hasShop = shopRes.has_shop;
			shopInfo = shopRes.shop;
		} catch {
			hasShop = false;
		}

		try {
			farmlands = await getMyFarmlands();
		} catch (err: any) {
			loadFarmlandError = err.message || 'Gagal memuat daftar lahan tani.';
		} finally {
			isLoading = false;
		}
	});

	function formatPrice(value: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function previewImage(): string {
		if (form.image_url_1) return form.image_url_1;
		return '';
	}

	function selectedFarmland(): Farmland | undefined {
		if (!form.farmland_id) return undefined;
		const id = Number(form.farmland_id);
		return eligibleFarmlands.find((f) => f.id === id);
	}

	function estimatedYield(): number {
		const fl = selectedFarmland();
		if (!fl?.ai_estimated_yield_kg) return 0;
		return Math.floor(Number(fl.ai_estimated_yield_kg) * 0.6);
	}

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		isSaving = true;
		errorMessage = '';
		successMessage = '';

		try {
			if (!form.name?.trim() || form.name.length < 3) {
				throw new Error('Nama produk minimal 3 karakter.');
			}
			if (!form.price || Number(form.price) <= 0) {
				throw new Error('Harga produk harus lebih besar dari 0.');
			}
			if (!form.description?.trim() || form.description.length < 10) {
				throw new Error('Deskripsi produk minimal 10 karakter.');
			}
			if (!form.image_url_1?.trim()) {
				throw new Error('Mohon isi URL gambar utama produk.');
			}

			const payload: CreateProductPayload = {
				name: form.name.trim(),
				price: Number(form.price),
				description: form.description.trim(),
				image_url: [form.image_url_1.trim()],
				is_pre_order: isPreOrder,
			};

			if (isPreOrder) {
				if (!form.farmland_id) {
					throw new Error('Produk Pre-Order wajib memilih lahan (farmland_id).');
				}
				payload.farmland_id = Number(form.farmland_id);
				if (form.po_quota_kg !== undefined && form.po_quota_kg !== null && !Number.isNaN(form.po_quota_kg)) {
					payload.po_quota_kg = Number(form.po_quota_kg);
				}
			} else {
				if (form.stock === undefined || form.stock === null || Number.isNaN(form.stock) || Number(form.stock) < 0) {
					throw new Error('Stok ready tidak boleh kurang dari 0.');
				}
				payload.stock = Number(form.stock);
			}

			const created = await createProduct(payload);
			successMessage = 'Produk berhasil dibuat! Mengalihkan ke halaman kelola produk...';
			setTimeout(() => goto(`/toko/produk/${created.id}`), 1400);
		} catch (err: any) {
			errorMessage = err.message || 'Gagal membuat produk.';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head><title>Buat Produk Baru | Tani Siaga</title></svelte:head>

<div class="edit-wrap">
	<div class="edit-main">
		<a class="back-link" href="/toko">← Kembali ke Dashboard Toko</a>

		{#if isLoading}
			<div class="state">Menyiapkan formulir pembuatan produk...</div>
		{:else if !isSeller}
			<section class="no-shop">
				<div class="no-shop-card">
					<div class="no-shop-icon">🚫</div>
					<p class="eyebrow">AKSES DITOLAK</p>
					<h1>Hanya seller yang dapat membuat produk</h1>
					<p class="subtitle">Fitur ini hanya tersedia untuk akun dengan peran seller (farmer, individual_farmer, group_leader, admin).</p>
					<div class="cta-row">
						<a class="primary-btn" href="/toko">Kembali ke Dashboard Toko</a>
						<a class="secondary-btn" href="/dashboard">Ke Dashboard Utama</a>
					</div>
				</div>
			</section>
		{:else if !hasShop}
			<section class="no-shop">
				<div class="no-shop-card">
					<div class="no-shop-icon">🌾</div>
					<p class="eyebrow">TOKO BELUM TERSEDIA</p>
					<h1>Anda belum punya toko.</h1>
					<p class="subtitle">Buat toko terlebih dahulu untuk mulai mendaftarkan produk ke Tani Siaga.</p>
					<div class="cta-row">
						<a class="primary-btn" href="/toko/create">Buat Toko Sekarang ↗</a>
						<a class="secondary-btn" href="/dashboard">Kembali ke Dashboard</a>
					</div>
				</div>
			</section>
		{:else}
			<div class="grid-layout">
				<aside class="preview-card">
					<div class="preview-image">
						{#if previewImage()}
							<img src={previewImage()} alt={form.name || 'Preview gambar produk'} />
						{:else}
							<span class="ph">🌾</span>
						{/if}
						<span class:po={isPreOrder} class="tag">
							{isPreOrder ? 'PRE-ORDER' : 'SIAP KIRIM'}
						</span>
					</div>
					<div class="preview-body">
						<p class="eyebrow">PREVIEW PRODUK</p>
						<h1>{form.name?.trim() || 'Nama produk kamu'}</h1>
						<p class="shop-link">Toko: {shopInfo?.name || currentUser?.email || 'Toko Saya'}</p>
						<strong class="price-big">
							{form.price && Number(form.price) > 0 ? formatPrice(Number(form.price)) : 'Rp 0'}
						</strong>
						<div class="stock-info">
							{#if isPreOrder}
								<div class="po-info">
									<span>Lahan dipilih</span>
									<strong>{selectedFarmland()?.name || 'Belum pilih lahan'}</strong>
								</div>
								<div class="po-info ok">
									<span>Kuota PO (saran AI)</span>
									<strong>{estimatedYield() || 0} Kg</strong>
								</div>
								<div class="po-info">
									<span>Kuota PO (final)</span>
									<strong>
										{form.po_quota_kg && !Number.isNaN(Number(form.po_quota_kg))
											? `${Number(form.po_quota_kg)} Kg`
											: `${estimatedYield()} Kg (default)`}
									</strong>
								</div>
							{:else}
								<div class="stock-info-inline">
									<span>Stok tersedia</span>
									<strong>
										{form.stock !== undefined && !Number.isNaN(Number(form.stock))
											? `${Number(form.stock)} unit`
											: '0 unit'}
									</strong>
								</div>
							{/if}
						</div>
						<p class="description-preview">
							{form.description?.trim() || 'Deskripsi produk akan tampil di sini. Jelaskan secara singkat tentang produk, manfaat, dan keunggulannya dibanding produk sejenis.'}
						</p>
					</div>
				</aside>

				<section class="form-section">
					<div class="page-heading">
						<p class="eyebrow">BUAT PRODUK BARU</p>
						<h1>Daftarkan Produk ke Toko</h1>
						<p class="subtitle">
							Pilih tipe penjualan: <strong>Ready Stock</strong> (misal: pestisida, peralatan, barang siap jual)
							atau <strong>Pre-Order</strong> (hasil panen dari lahan tertentu yang masih dalam masa tanam).
						</p>
					</div>

					{#if errorMessage}<div class="alert error">{errorMessage}</div>{/if}
					{#if successMessage}<div class="alert success">{successMessage}</div>{/if}

					<form class="form-card" onsubmit={handleCreate}>
						<div class="type-switcher" role="group" aria-label="Tipe produk">
							<button
								type="button"
								class:active={!isPreOrder}
								onclick={() => {
									isPreOrder = false;
									form.farmland_id = '';
								}}
							>
								<span class="type-icon">📦</span>
								<span class="type-title">Ready Stock</span>
								<span class="type-desc">Produk siap kirim (stok fisik)</span>
							</button>
							<button
								type="button"
								class:active={isPreOrder}
								onclick={() => {
									isPreOrder = true;
									form.stock = undefined;
								}}
							>
								<span class="type-icon">🌱</span>
								<span class="type-title">Pre-Order Panen</span>
								<span class="type-desc">Dijual sebelum panen (wajib pilih lahan)</span>
							</button>
						</div>

						<div class="field-grid">
							<label class="full">
								Nama Produk
								<input bind:value={form.name} required minlength="3" maxlength="100" placeholder="Contoh: Beras Pandan Wangi 5 Kg" />
								<small>Maksimal 100 karakter</small>
							</label>

							<label>
								Harga (Rp)
								<input type="number" bind:value={form.price} required min="1" step="1" placeholder="Contoh: 75000" />
								<small>Harga per Kg / per unit</small>
							</label>

							{#if !isPreOrder}
								<label>
									Stok Ready
									<input
										type="number"
										bind:value={form.stock}
										min="0"
										step="1"
										placeholder="Stok saat ini"
									/>
									<small>Stok fisik yang siap dijual (tidak bisa negatif)</small>
								</label>
							{:else}
								<label>
									Kuota Pre-Order (Kg)
									<input
										type="number"
										bind:value={form.po_quota_kg}
										min="1"
										step="1"
										placeholder={estimatedYield() ? `Opsional. Saran AI: ${estimatedYield()} Kg` : 'Opsional. Isi jika ingin override.'}
									/>
									<small>
										{#if estimatedYield() > 0}
											Kosongkan = pakai saran AI ({estimatedYield()} Kg, 60% dari estimasi panen lahan).
										{:else}
											Kosongkan = dihitung otomatis dari estimasi AI panen lahan.
										{/if}
									</small>
								</label>
							{/if}

							<label class="full">
								URL Gambar Utama
								<input bind:value={form.image_url_1} placeholder="https://link-gambar-produk.jpg" type="url" />
								<small>Masukkan link URL gambar produk (format HTTPS). Ukuran disarankan 1:1 / landscape.</small>
							</label>

							{#if isPreOrder}
								<label class="full">
									<span class="required-inline">
										Lahan Sumber Panen
										<abbr title="wajib diisi untuk produk Pre-Order">*</abbr>
									</span>
									{#if loadFarmlandError}
										<div class="mini-error">⚠️ {loadFarmlandError}</div>
									{:else if eligibleFarmlands.length === 0}
										<div class="mini-warn">
											⚠️ Tidak ada lahan aktif yang dapat dipakai untuk pre-order.
											{#if currentUser?.farmer_group_id && currentUser.role !== 'group_leader'}<span>Pre-order dari lahan kelompok hanya dapat dibuat oleh ketua kelompok.</span>{:else}<a href="/lahan-tani/create" target="_blank" rel="noopener noreferrer">Buat lahan terlebih dahulu →</a>{/if}
										</div>
									{/if}
									<select bind:value={form.farmland_id} disabled={eligibleFarmlands.length === 0}>
										<option value="">-- Pilih lahan tani --</option>
										{#each eligibleFarmlands as fl (fl.id)}
											<option value={fl.id}>
												{fl.name}
												{#if fl.commodity?.name} · {fl.commodity.name}{/if}
												{#if fl.area_size} · {fl.area_size} m²{/if}
												{#if fl.plant_date} · Tanam: {new Date(fl.plant_date).toLocaleDateString('id-ID', { dateStyle: 'short' })}{/if}
											</option>
										{/each}
									</select>
									<small>
										Hanya lahan aktif yang dapat dikelola akunmu yang muncul. Produk lama yang sudah panen tidak dibuka kembali saat lahan ditanami ulang.
									</small>
								</label>
							{/if}

							<label class="full">
								Deskripsi Produk
								<textarea bind:value={form.description} rows="6" minlength="10" maxlength="1500" required placeholder="Deskripsikan produk, manfaat, cara penggunaan, kemasan, keunggulan, dll"></textarea>
								<small>{form.description?.length || 0} / 1500 karakter</small>
							</label>
						</div>

						<div class="form-actions">
							<a href="/toko" class="cancel">Batal</a>
							<button class="primary" type="submit" disabled={isSaving}>
								{isSaving ? 'Menyimpan produk...' : 'Buat Produk'}
							</button>
						</div>
					</form>
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
	.ph { font-size: 80px; }
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
	.preview-body { padding: 26px 26px 28px; }
	.eyebrow {
		margin: 0 0 10px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.preview-body h1 {
		margin: 0;
		font: 600 28px/1.1 'Fraunces', Georgia, serif;
	}
	.shop-link {
		margin: 8px 0 16px;
		color: #718077;
		font-size: 13px;
	}
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
	.po-info strong { background: #eaf4e9; color: #183126; border-radius: 4px; padding: 2px 8px; font-size: 12px; }
	.stock-info-inline strong { color: #2f6a41; }
	.po-info.ok { background: #edf8ed; }
	.description-preview {
		margin: 0;
		padding: 14px;
		background: #fbfdfb;
		border: 1px dashed #d6e1d5;
		border-radius: 8px;
		color: #385540;
		font-size: 13px;
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.form-section { display: grid; gap: 20px; }
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
	.subtitle strong { color: #385540; }

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

	.type-switcher {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 14px;
	}
	.type-switcher button {
		display: grid;
		justify-items: start;
		gap: 6px;
		padding: 20px 22px;
		border-radius: 10px;
		border: 2px solid #d6e1d5;
		background: #fbfdfb;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: #385540;
		transition: all 0.15s ease;
	}
	.type-switcher button:hover { border-color: #9fc6a5; background: #f2f9f0; }
	.type-switcher button.active {
		border-color: #39754b;
		background: linear-gradient(180deg, #eff8f0 0%, #e3f1e4 100%);
		box-shadow: 0 6px 18px #39754b18;
	}
	.type-icon { font-size: 26px; line-height: 1; }
	.type-title {
		font: 700 16px 'DM Sans', sans-serif;
		color: #183126;
	}
	.type-switcher button.active .type-title { color: #2a6039; }
	.type-desc {
		font-size: 12px;
		color: #5b6e62;
		font-weight: 500;
		line-height: 1.4;
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
	.required-inline {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.required-inline abbr {
		color: #a44242;
		text-decoration: none;
		font-weight: 900;
	}
	.mini-error, .mini-warn {
		padding: 10px 12px;
		border-radius: 7px;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.4;
	}
	.mini-error { background: #fff0ef; color: #a44242; border: 1px solid #e6b8b3; }
	.mini-warn { background: #fff8e8; color: #825a17; border: 1px solid #e8d39a; }
	.mini-warn a { color: #39754b; text-decoration: underline; margin-left: 6px; }
	input, textarea, select {
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
	input:focus, textarea:focus, select:focus {
		border-color: #5c9568;
		box-shadow: 0 0 0 3px #5c95681c;
	}
	select:disabled { opacity: 0.6; cursor: not-allowed; }
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

	.no-shop {
		display: grid;
		place-items: center;
		padding: 30px 20px;
	}
	.no-shop-card {
		max-width: 620px;
		padding: 50px 44px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 14px;
		background: #fff;
		box-shadow: 0 12px 34px #23472e10;
	}
	.no-shop-icon { font-size: 72px; margin-bottom: 16px; }
	.no-shop-card h1 {
		margin: 0;
		font: 600 clamp(28px, 5vw, 44px)/1 'Fraunces', Georgia, serif;
	}
	.subtitle {
		margin: 16px auto 30px;
		color: #718077;
		line-height: 1.6;
		max-width: 460px;
	}
	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		justify-content: center;
	}
	.cta-row .primary-btn {
		display: inline-block;
		padding: 14px 20px;
		border-radius: 8px;
		background: #39754b;
		color: #fff;
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
		box-shadow: 0 8px 18px #39754b26;
	}
	.cta-row .secondary-btn {
		display: inline-block;
		padding: 14px 20px;
		border-radius: 8px;
		background: #fff;
		color: #39754b;
		border: 1px solid #a9c9aa;
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
	}

	@media (max-width: 1000px) {
		.grid-layout { grid-template-columns: 1fr; }
		.preview-card { position: static; }
	}
	@media (max-width: 760px) {
		.field-grid { grid-template-columns: 1fr; }
		label.full { grid-column: span 1; }
		.type-switcher { grid-template-columns: 1fr; }
	}
</style>
