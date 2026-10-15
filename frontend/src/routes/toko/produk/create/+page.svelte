<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { createProduct, type CreateProductPayload } from '$lib/api/product-api';
	import { uploadImages } from '$lib/api/media-api';
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
	let selectedImages = $state<File[]>([]);
	let imagePreviewUrl = $state('');

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
		farmland_id: number | '';
		po_quota_kg: number | undefined;
	}>({
		name: '',
		price: undefined,
		stock: undefined,
		description: '',
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
			if (shopRes.shop?.banned_until && new Date(shopRes.shop.banned_until).getTime() > Date.now()) {
				await goto('/toko', { replaceState: true });
				return;
			}
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
			if (!selectedImages.length) {
				throw new Error('Pilih minimal satu gambar produk.');
			}

			const imageUrls = await uploadImages(selectedImages, 'product');
			const payload: CreateProductPayload = {
				name: form.name.trim(),
				price: Number(form.price),
				description: form.description.trim(),
				image_url: imageUrls,
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

			await createProduct(payload);
			successMessage = 'Produk berhasil dikirim dan sedang menunggu persetujuan admin.';
			await goto('/toko');
		} catch (err: any) {
			errorMessage = err.message || 'Gagal membuat produk.';
		} finally {
			isSaving = false;
		}
	}

	onDestroy(() => {
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
	});
</script>

<svelte:head><title>Buat Produk Baru | Tani Siaga</title></svelte:head>

<div class="bungkus-ubah">
	<div class="utama-ubah">
		<a class="tautan-kembali" href="/toko">← Kembali ke Dashboard Toko</a>

		{#if isLoading}
			<div class="keadaan">Menyiapkan formulir pembuatan produk...</div>
		{:else if !isSeller}
			<section class="toko-tanpa">
				<div class="kartu-toko-tanpa">
					<div class="ikon-toko-tanpa">🚫</div>
					<p class="label-kecil">AKSES DITOLAK</p>
					<h1 class="judul">Hanya seller yang dapat membuat produk</h1>
					<p class="subjudul">Fitur ini hanya tersedia untuk akun dengan peran seller (farmer, individual_farmer, group_leader, admin).</p>
					<div class="baris-ajakan">
						<a class="tombol-utama" href="/toko">Kembali ke Dashboard Toko</a>
						<a class="tombol-pendukung" href="/dashboard">Ke Dashboard Utama</a>
					</div>
				</div>
			</section>
		{:else if !hasShop}
			<section class="toko-tanpa">
				<div class="kartu-toko-tanpa">
					<div class="ikon-toko-tanpa">🌾</div>
					<p class="label-kecil">TOKO BELUM TERSEDIA</p>
					<h1 class="judul">Anda belum punya toko.</h1>
					<p class="subjudul-toko-kosong">Buat toko terlebih dahulu untuk mulai mendaftarkan produk ke Tani Siaga.</p>
					<div class="baris-ajakan">
						<a class="tombol-utama" href="/toko/create">Buat Toko Sekarang ↗</a>
						<a class="tombol-pendukung" href="/dashboard">Kembali ke Dashboard</a>
					</div>
				</div>
			</section>
		{:else if shopInfo && shopInfo.approval_status !== 'approved'}
			<section class="toko-tanpa">
				<div class="kartu-toko-tanpa kartu-peringatan">
					<div class="ikon-toko-tanpa">⏳</div>
					<p class="label-kecil">MENUNGGU PERSETUJUAN ADMIN</p>
					<h1 class="judul">Toko Anda belum disetujui.</h1>
					<p class="subjudul">Produk baru hanya bisa dibuat setelah toko Anda disetujui oleh admin. Silakan tunggu konfirmasi berikutnya.</p>
					<div class="baris-ajakan">
						<a class="tombol-utama" href="/toko">Kembali ke Dashboard Toko</a>
						<a class="tombol-pendukung" href="/dashboard">Dashboard Utama</a>
					</div>
				</div>
			</section>
		{:else}
			<div class="tata-kisi">
				<aside class="kartu-pratinjau">
					<div class="gambar-pratinjau">
						{#if imagePreviewUrl}
							<img src={imagePreviewUrl} alt={form.name || 'Preview gambar produk'} />
						{:else}
							<span class="petunjuk">🌾</span>
						{/if}
						<span class:pra-pesan={isPreOrder} class="label">
							{isPreOrder ? 'PRE-ORDER' : 'SIAP KIRIM'}
						</span>
					</div>
					<div class="isi-pratinjau">
						<p class="label-kecil">PREVIEW PRODUK</p>
						<h1 class="judul">{form.name?.trim() || 'Nama produk kamu'}</h1>
						<p class="tautan-toko">Toko: {shopInfo?.name || currentUser?.email || 'Toko Saya'}</p>
						<strong class="besar-harga">
							{form.price && Number(form.price) > 0 ? formatPrice(Number(form.price)) : 'Rp 0'}
						</strong>
						<div class="informasi-stok">
							{#if isPreOrder}
								<div class="informasi-pra-pesan">
									<span>Lahan dipilih</span>
									<strong>{selectedFarmland()?.name || 'Belum pilih lahan'}</strong>
								</div>
								<div class="informasi-pra-pesan berhasil">
									<span>Kuota PO (saran AI)</span>
									<strong>{estimatedYield() || 0} Kg</strong>
								</div>
								<div class="informasi-pra-pesan">
									<span>Kuota PO (final)</span>
									<strong>
										{form.po_quota_kg && !Number.isNaN(Number(form.po_quota_kg))
											? `${Number(form.po_quota_kg)} Kg`
											: `${estimatedYield()} Kg (default)`}
									</strong>
								</div>
							{:else}
								<div class="sebaris-informasi-stok">
									<span>Stok tersedia</span>
									<strong>
										{form.stock !== undefined && !Number.isNaN(Number(form.stock))
											? `${Number(form.stock)} unit`
											: '0 unit'}
									</strong>
								</div>
							{/if}
						</div>
						<p class="pratinjau-deskripsi">
							{form.description?.trim() || 'Deskripsi produk akan tampil di sini. Jelaskan secara singkat tentang produk, manfaat, dan keunggulannya dibanding produk sejenis.'}
						</p>
					</div>
				</aside>

				<section class="bagian-formulir">
					<div class="judul-halaman">
						<p class="label-kecil">BUAT PRODUK BARU</p>
						<h1 class="judul">Daftarkan Produk ke Toko</h1>
						<p class="subjudul">
							Pilih tipe penjualan: <strong>Ready Stock</strong> (misal: pestisida, peralatan, barang siap jual)
							atau <strong>Pre-Order</strong> (hasil panen dari lahan tertentu yang masih dalam masa tanam).
						</p>
					</div>

					{#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
					{#if successMessage}<div class="peringatan berhasil">{successMessage}</div>{/if}

					<form class="kartu-formulir" onsubmit={handleCreate}>
						<div class="pengalih-jenis" role="group" aria-label="Tipe produk">
							<button
								type="button"
								class:aktif={!isPreOrder}
								onclick={() => {
									isPreOrder = false;
									form.farmland_id = '';
								}}
							>
								<span class="ikon-jenis">📦</span>
								<span class="judul-jenis">Ready Stock</span>
								<span class="deskripsi-jenis">Produk siap kirim (stok fisik)</span>
							</button>
							<button
								type="button"
								class:aktif={isPreOrder}
								onclick={() => {
									isPreOrder = true;
									form.stock = undefined;
								}}
							>
								<span class="ikon-jenis">🌱</span>
								<span class="judul-jenis">Pre-Order Panen</span>
								<span class="deskripsi-jenis">Dijual sebelum panen (wajib pilih lahan)</span>
							</button>
						</div>

						<div class="kisi-bidang">
							<label class="penuh">
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

							<label class="penuh">
								Foto Produk
								<span class="pemilih-foto"><input type="file" accept="image/jpeg,image/png,image/webp" multiple required onchange={handleImageSelection} /><span class="tombol-pemilih-foto">Pilih foto</span><span class="nama-pemilih-foto">{selectedImages.length ? `${selectedImages.length} foto dipilih` : 'Belum ada foto'}</span></span>
								<small>Pilih maksimal 5 foto JPG, PNG, atau WebP. Maksimal 5 MB per foto.{selectedImages.length ? ` ${selectedImages.length} foto dipilih.` : ''}</small>
							</label>

							{#if isPreOrder}
								<label class="penuh">
									<span class="sebaris-wajib">
										Lahan Sumber Panen
										<abbr title="wajib diisi untuk produk Pre-Order">*</abbr>
									</span>
									{#if loadFarmlandError}
										<div class="galat-mini">⚠️ {loadFarmlandError}</div>
									{:else if eligibleFarmlands.length === 0}
										<div class="peringatan-mini">
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

							<label class="penuh">
								Deskripsi Produk
								<textarea bind:value={form.description} rows="6" minlength="10" maxlength="1500" required placeholder="Deskripsikan produk, manfaat, cara penggunaan, kemasan, keunggulan, dll"></textarea>
								<small>{form.description?.length || 0} / 1500 karakter</small>
							</label>
						</div>

						<div class="aksi-formulir">
							<a href="/toko" class="batal">Batal</a>
							<button class="utama" type="submit" disabled={isSaving}>
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
	.isi-pratinjau h1 {
		margin: 0;
		font: 600 28px/1.1 'Fraunces', Georgia, serif;
	}
	.tautan-toko {
		margin: 8px 0 16px;
		color: #718077;
		font-size: 13px;
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
		border-radius: 4px;
		padding: 2px 8px;
		font-size: 12px;
	}
	.sebaris-informasi-stok strong {
		color: #2f6a41;
	}
	.informasi-pra-pesan.berhasil {
		background: #edf8ed;
	}
	.pratinjau-deskripsi {
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
	.subjudul strong {
		color: #385540;
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
	.pengalih-jenis {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 14px;
	}
	.pengalih-jenis button {
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
	.pengalih-jenis button:hover {
		border-color: #9fc6a5;
		background: #f2f9f0;
	}
	.pengalih-jenis button.aktif {
		border-color: #39754b;
		background: linear-gradient(180deg, #eff8f0 0%, #e3f1e4 100%);
		box-shadow: 0 6px 18px #39754b18;
	}
	.ikon-jenis {
		font-size: 26px;
		line-height: 1;
	}
	.judul-jenis {
		font: 700 16px 'DM Sans', sans-serif;
		color: #183126;
	}
	.pengalih-jenis button.aktif .judul-jenis {
		color: #2a6039;
	}
	.deskripsi-jenis {
		font-size: 12px;
		color: #5b6e62;
		font-weight: 500;
		line-height: 1.4;
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
	.sebaris-wajib {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.sebaris-wajib abbr {
		color: #a44242;
		text-decoration: none;
		font-weight: 900;
	}
	.galat-mini, .peringatan-mini {
		padding: 10px 12px;
		border-radius: 7px;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.4;
	}
	.galat-mini {
		background: #fff0ef;
		color: #a44242;
		border: 1px solid #e6b8b3;
	}
	.peringatan-mini {
		background: #fff8e8;
		color: #825a17;
		border: 1px solid #e8d39a;
	}
	.peringatan-mini a {
		color: #39754b;
		text-decoration: underline;
		margin-left: 6px;
	}
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
	select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
	.toko-tanpa {
		display: grid;
		place-items: center;
		padding: 30px 20px;
	}
	.kartu-toko-tanpa {
		max-width: 620px;
		padding: 50px 44px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 14px;
		background: #fff;
		box-shadow: 0 12px 34px #23472e10;
	}
	.ikon-toko-tanpa {
		font-size: 72px;
		margin-bottom: 16px;
	}
	.kartu-toko-tanpa h1 {
		margin: 0;
		font: 600 clamp(28px, 5vw, 44px)/1 'Fraunces', Georgia, serif;
	}
	.subjudul-toko-kosong {
		margin: 16px auto 30px;
		color: #718077;
		line-height: 1.6;
		max-width: 460px;
	}
	.baris-ajakan {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		justify-content: center;
	}
	.baris-ajakan .tombol-utama {
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
	.baris-ajakan .tombol-pendukung {
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
		.pengalih-jenis {
			grid-template-columns: 1fr;
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
