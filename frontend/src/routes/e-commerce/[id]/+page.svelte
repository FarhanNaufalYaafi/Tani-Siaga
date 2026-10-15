
<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		addToCart,
		createProductReview,
		deleteProductReview,
		getProductById,
		getProductReviewEligibility,
		getProductReviews,
		getProducts,
		updateProductReview,
		type Product,
		type ProductReviewsResponse,
		type ProductWeatherForecast
	} from '$lib/api/product-api';
	import { deactivateProductByAdmin, deleteProductByAdmin } from '$lib/api/admin-api';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { getPublicShop, type PublicShopResponse } from '$lib/api/shop-api';
	import Card from '$lib/components/Card.svelte';
	import { showAlert, showConfirm, showInput } from '$lib/services/dialog';
	import { uploadImages } from '$lib/api/media-api';

	let product = $state<Product | null>(null);
	let currentUser = $state<CurrentUserDto | null>(null);
	let shop = $state<PublicShopResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let quantity = $state(1);
	let isAdding = $state(false);
	let isModerating = $state(false);
	let reviewsDetails = $state<HTMLDetailsElement>();
	let purchaseMode = $state<'cart' | 'buy_now'>('cart');
	let notice = $state('');
	let recommendedReady = $state<Product[]>([]);
	let recommendedPreOrder = $state<Product[]>([]);
	let productReviews = $state<ProductReviewsResponse>({ average_rating: 0, rating_count: 0, reviews: [], meta: { page: 1, limit: 2, total: 0, total_pages: 1 } });
	let eligibleReviewOrderIds = $state<number[]>([]);
	let hasExistingReview = $state(false);
	let currentReviewId = $state<number | null>(null);
	let selectedReviewOrderId = $state<number | null>(null);
	let reviewRating = $state(0);
	let reviewComment = $state('');
	let reviewImageFiles = $state<File[]>([]);
	let reviewImagePreviews = $state<string[]>([]);
	let reviewLoading = $state(false);
	let reviewSubmitting = $state(false);
	let reviewError = $state('');
	let reviewNotice = $state('');
	let editingReviewId = $state<number | null>(null);
	let editingReviewRating = $state(0);
	let editingReviewComment = $state('');
	let editingReviewImages = $state<string[]>([]);
	let editingReviewImageFiles = $state<File[]>([]);
	let editingReviewImagePreviews = $state<string[]>([]);
	let editingReviewImagesChanged = $state(false);
	let savingReview = $state(false);
	let weatherRange = $state<'today' | 'tomorrow' | 'later'>('today');
	let isAdmin = $derived(currentUser?.role === 'admin');

	let harvestByKg = $derived(Boolean(product?.is_pre_order || product?.farmland_id));
	let availableQuantity = $derived(product ? product.is_pre_order ? Math.max(0, product.po_quota_kg - product.po_booked_kg) : Math.max(0, product.stock - product.po_booked_kg) : 0);
	let bookedPercentage = $derived(product && product.po_quota_kg > 0 ? Math.min(100, Math.round((product.po_booked_kg / product.po_quota_kg) * 100)) : 0);
	let visibleForecasts = $derived.by(() => {
		const forecasts = product?.weather_forecasts || [];
		if (weatherRange === 'today') return forecasts.slice(0, 4);
		if (weatherRange === 'tomorrow') return forecasts.slice(4, 8);
		return forecasts.slice(8, 12);
	});

	$effect(() => {
		if (availableQuantity > 0 && quantity > availableQuantity) {
			quantity = availableQuantity;
		}
	});

	async function loadProduct(id: string) {
		isLoading = true;
		errorMessage = '';
		shop = null;
		recommendedReady = [];
		recommendedPreOrder = [];
		try {
			product = await getProductById(id);
			if (product.shop?.id) shop = await getPublicShop(product.shop.id);
			const [readyStock, preOrder] = await Promise.all([
				getProducts('ready_stock', 1, 5),
				getProducts('pre_order', 1, 5),
			]);
			const currentProductId = Number(product.id);
			recommendedReady = readyStock.data.filter((item) => Number(item.id) !== currentProductId).slice(0, 4);
			recommendedPreOrder = preOrder.data.filter((item) => Number(item.id) !== currentProductId).slice(0, 4);
			await loadProductReviews(product.id);
			if (currentUser) await loadReviewEligibility(product.id);
			if (window.location.hash === '#ulasan-pembeli') {
				if (reviewsDetails) reviewsDetails.open = true;
				await tick();
				document.getElementById('ulasan-pembeli')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat produk.';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		const id = page.params.id;
		if (id) void loadProduct(id);
	});

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
			if (currentUser && product) await loadReviewEligibility(product.id);
		} catch {
			currentUser = null;
		}
	});

	async function loadProductReviews(productId: number) {
		try {
			productReviews = await getProductReviews(productId, 1, 2);
			reviewError = '';
		} catch (error) {
			reviewError = error instanceof Error ? error.message : 'Gagal memuat ulasan produk.';
		}
	}

	async function loadReviewEligibility(productId: number) {
		reviewLoading = true;
		try {
			const eligibility = await getProductReviewEligibility(productId);
			eligibleReviewOrderIds = eligibility.order_ids;
			selectedReviewOrderId = eligibility.order_ids[0] || null;
			hasExistingReview = eligibility.has_review;
			currentReviewId = eligibility.review_id;
		} catch (error) {
			eligibleReviewOrderIds = [];
			selectedReviewOrderId = null;
			hasExistingReview = false;
			currentReviewId = null;
			reviewError = error instanceof Error ? error.message : 'Gagal memeriksa kelayakan ulasan.';
		} finally {
			reviewLoading = false;
		}
	}

	async function submitReview() {
		if (!product || !selectedReviewOrderId || reviewRating < 1) {
			reviewError = 'Pilih rating bintang terlebih dahulu.';
			return;
		}
		reviewSubmitting = true;
		reviewError = '';
		reviewNotice = '';
		try {
			const imageUrls = reviewImageFiles.length
				? await uploadImages(reviewImageFiles, 'review')
				: [];
			await createProductReview(product.id, {
				orderId: selectedReviewOrderId,
				rating: reviewRating,
				comment: reviewComment.trim(),
				image_urls: imageUrls,
			});
			reviewNotice = 'Terima kasih, rating dan ulasan berhasil dikirim.';
			reviewRating = 0;
			reviewComment = '';
			clearImagePreviews(reviewImagePreviews);
			reviewImageFiles = [];
			reviewImagePreviews = [];
			await Promise.all([loadProductReviews(product.id), loadReviewEligibility(product.id)]);
		} catch (error) {
			reviewError = error instanceof Error ? error.message : 'Gagal mengirim ulasan.';
		} finally {
			reviewSubmitting = false;
		}
	}

	function handleReviewImageSelection(event: Event, editing = false) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files || []);
		if (files.length > 5) {
			reviewError = 'Pilih maksimal 5 foto ulasan.';
			input.value = '';
			return;
		}
		if (files.some((file) => file.size > 5 * 1024 * 1024)) {
			reviewError = 'Ukuran setiap foto ulasan maksimal 5 MB.';
			input.value = '';
			return;
		}
		const previews = files.map((file) => URL.createObjectURL(file));
		if (editing) {
			clearImagePreviews(editingReviewImagePreviews);
			editingReviewImageFiles = files;
			editingReviewImagePreviews = previews;
			editingReviewImagesChanged = true;
		} else {
			clearImagePreviews(reviewImagePreviews);
			reviewImageFiles = files;
			reviewImagePreviews = previews;
		}
		reviewError = '';
	}

	function clearImagePreviews(previews: string[]) {
		for (const preview of previews) URL.revokeObjectURL(preview);
	}

	onDestroy(() => {
		clearImagePreviews(reviewImagePreviews);
		clearImagePreviews(editingReviewImagePreviews);
	});

	function canManageReview(reviewUserId: number) {
		return isAdmin || Number(currentUser?.id ?? currentUser?.userId ?? 0) === reviewUserId;
	}

	function canEditReview(reviewUserId: number) {
		return Number(currentUser?.id ?? currentUser?.userId ?? 0) === reviewUserId;
	}

	function startEditingReview(review: ProductReviewsResponse['reviews'][number]) {
		editingReviewId = review.id;
		editingReviewRating = review.rating;
		editingReviewComment = review.comment;
		editingReviewImages = [...review.image_urls];
		editingReviewImagesChanged = false;
		clearImagePreviews(editingReviewImagePreviews);
		editingReviewImageFiles = [];
		editingReviewImagePreviews = [];
		reviewError = '';
		reviewNotice = '';
	}

	async function saveProductReview(reviewId: number) {
		if (!product || editingReviewRating < 1 || editingReviewRating > 5) {
			reviewError = 'Pilih rating bintang 1 sampai 5.';
			return;
		}
		savingReview = true;
		reviewError = '';
		reviewNotice = '';
		try {
			const imageUrls = editingReviewImageFiles.length
				? await uploadImages(editingReviewImageFiles, 'review')
				: editingReviewImagesChanged
					? editingReviewImages
					: undefined;
			await updateProductReview(product.id, reviewId, {
				rating: editingReviewRating,
				comment: editingReviewComment.trim(),
				...(imageUrls !== undefined ? { image_urls: imageUrls } : {}),
			});
			editingReviewId = null;
			clearImagePreviews(editingReviewImagePreviews);
			editingReviewImageFiles = [];
			editingReviewImagePreviews = [];
			reviewNotice = 'Ulasan berhasil diperbarui.';
			await Promise.all([loadProductReviews(product.id), loadReviewEligibility(product.id)]);
		} catch (error) {
			reviewError = error instanceof Error ? error.message : 'Gagal memperbarui ulasan.';
		} finally {
			savingReview = false;
		}
	}

	async function removeProductReview(reviewId: number) {
		if (!product) return;
		if (!await showConfirm('Ulasan yang dihapus tidak dapat dipulihkan.', {
			title: 'Hapus ulasan?',
			confirmLabel: 'Hapus ulasan',
			tone: 'error',
		})) return;
		reviewError = '';
		reviewNotice = '';
		try {
			await deleteProductReview(product.id, reviewId);
			reviewNotice = 'Ulasan berhasil dihapus.';
			await Promise.all([loadProductReviews(product.id), loadReviewEligibility(product.id)]);
		} catch (error) {
			reviewError = error instanceof Error ? error.message : 'Gagal menghapus ulasan.';
		}
	}

	function reviewDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));
	}

	function price(value: number) {
		return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
	}

	function formatSoldQuantity(value?: number | null) {
		const total = Number(value ?? 0);
		if (!Number.isFinite(total) || total <= 0) return '0';
		if (total < 1000) return `${total}`;
		if (total < 10000) return `${Math.floor(total / 1000) * 1000}+`;
		if (total < 1000000) return `${Math.floor(total / 1000) * 1000}+`;
		return `${Math.floor(total / 1000000)}jt+`;
	}

	function date(value: string | null | undefined) {
		return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '-';
	}

	function forecastDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', {
			weekday: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(value));
	}

	function image(item: Product | PublicShopResponse['products'][number]) {
		return item.image_url?.[0] || '';
	}

	async function add() {
		if (!product) return;
		if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > availableQuantity) {
			errorMessage = `Jumlah melebihi ketersediaan. Maksimal ${availableQuantity} kg.`;
			return;
		}
		isAdding = true;
		purchaseMode = 'cart';
		notice = '';
		errorMessage = '';
		try {
			await addToCart(product.id, Number(quantity));
			notice = 'Produk berhasil ditambahkan ke keranjang.';
		} catch (error: any) {
			if (error.message?.toLowerCase().includes('unauthorized') || error.message?.toLowerCase().includes('login')) await goto('/signin');
			else errorMessage = error.message || 'Gagal menambahkan produk.';
		} finally {
			isAdding = false;
		}
	}

	async function buyNow() {
		if (!product) return;
		if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > availableQuantity) {
			errorMessage = `Jumlah harus antara 1 dan ${availableQuantity}.`;
			return;
		}
		isAdding = true;
		purchaseMode = 'buy_now';
		notice = '';
		errorMessage = '';
		try {
			await goto(`/checkout/buy-now-${product.id}?quantity=${Number(quantity)}`);
		} catch (error: any) {
			if (error.message?.toLowerCase().includes('unauthorized') || error.message?.toLowerCase().includes('login')) await goto('/signin');
			else errorMessage = error.message || 'Gagal memulai checkout.';
		} finally {
			isAdding = false;
		}
	}

	function changeQuantity(delta: number) {
		quantity = Math.min(Math.max(1, Number(quantity || 1) + delta), Math.max(1, availableQuantity));
	}

	async function moderateProduct(action: 'disabled' | 'deleted') {
		if (!product || !isAdmin) return;
		if (action === 'deleted' && !await showConfirm(
			`Produk "${product.name}" akan dihapus dari publikasi dan stoknya menjadi 0.`,
			{ title: 'Hapus produk?', confirmLabel: 'Lanjutkan', tone: 'error' },
		)) return;

		const reason = await showInput({
			title: action === 'disabled' ? 'Nonaktifkan produk' : 'Hapus produk',
			message: 'Alasan ini akan dikirim kepada pemilik toko dan ditampilkan di dashboard toko.',
			input: { label: 'Alasan admin', placeholder: 'Tulis alasan tindakan', required: true },
			confirmLabel: action === 'disabled' ? 'Nonaktifkan' : 'Hapus produk',
			tone: 'warning',
		});
		if (reason === null) return;

		isModerating = true;
		errorMessage = '';
		try {
			if (action === 'disabled') await deactivateProductByAdmin(product.id, reason);
			else await deleteProductByAdmin(product.id, reason);
			await showAlert(
				action === 'disabled' ? 'Produk dinonaktifkan dan alasannya dikirim ke pemilik toko.' : 'Produk dihapus dan alasannya dikirim ke pemilik toko.',
				{ title: 'Tindakan admin berhasil', tone: 'success' },
			);
			await goto('/toko');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memoderasi produk.';
		} finally {
			isModerating = false;
		}
	}
</script>

<svelte:head>
	<title>{product ? `${product.name} | E-Commerce` : 'Detail Produk'}</title>
</svelte:head>

<div class="kerangka-halaman">
	<div class="wadah-halaman">
		<a class="kembali" href="/e-commerce">← Kembali ke katalog</a>
		{#if isLoading}
			<div class="keadaan">Memuat produk...</div>
		{:else if errorMessage && !product}
			<div class="keadaan galat">{errorMessage}</div>
		{:else if product}
			<section class="rincian-produk">
				<div class="visual">
					{#if image(product)}
						<img src={image(product)} alt={product.name} />
					{:else}
						<span class="contoh">🌾</span>
					{/if}
				</div>
				<div class="isi">
					<p class="label-kecil">PRODUK DARI PETANI LOKAL</p>
					<h1 class="judul">{product.name}</h1>
					<strong class="harga">{price(product.price)}</strong>
					{#if product.is_pre_order}
						<div class="panel-indikator panel-pra-pesan">
							<div class="judul-indikator"><span>Kuota pre-order terisi</span><strong>{bookedPercentage}%</strong></div>
							<progress class="jalur-kemajuan" max="100" value={bookedPercentage}></progress>
							<div class="rincian-indikator"><span>{product.po_booked_kg} kg sudah dipesan</span><span>{availableQuantity} kg tersisa</span></div>
						</div>
						{#if product.estimated_harvest_date}<p class="panen">Perkiraan panen {date(product.estimated_harvest_date)}</p>{/if}
					{:else}
						<div class="panel-indikator panel-siap">
							<span>Jumlah terjual</span>
							<strong>{formatSoldQuantity(product.sold_quantity)} unit</strong>
							<small>{product.stock} {harvestByKg ? 'kg stok total' : 'unit stok total'}</small>
							{#if product.po_booked_kg > 0}<small>{product.po_booked_kg} kg dikunci untuk pre-order</small>{/if}
							<small>{availableQuantity} {harvestByKg ? 'kg' : 'unit'} masih tersedia</small>
						</div>
					{/if}
					<div class="baris-beli">
						<label>Jumlah
							<span class="kontrol-jumlah">
								<button type="button" aria-label="Kurangi jumlah" onclick={() => changeQuantity(-1)} disabled={quantity <= 1}>−</button>
								<input type="number" min="1" max={Math.max(1, availableQuantity)} step="1" bind:value={quantity} onblur={() => { quantity = Math.min(Math.max(1, Math.floor(Number(quantity) || 1)), Math.max(1, availableQuantity)); }} />
								<button type="button" aria-label="Tambah jumlah" onclick={() => changeQuantity(1)} disabled={quantity >= availableQuantity}>+</button>
							</span>
						</label>
						<div class="aksi-pembelian">
							<button class="aksi-keranjang" onclick={add} disabled={isAdding || availableQuantity < 1}>{isAdding && purchaseMode === 'cart' ? 'Menambahkan...' : 'Tambah ke keranjang'}</button>
							<button class="aksi-sekarang-beli" onclick={buyNow} disabled={isAdding || availableQuantity < 1}>{isAdding && purchaseMode === 'buy_now' ? 'Menyiapkan checkout...' : 'Beli sekarang'}</button>
						</div>
					</div>
					{#if notice}<div class="peringatan">{notice} <a href="/keranjang">Lihat keranjang</a></div>{/if}
					{#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
					{#if isAdmin}
						<section class="moderasi-admin">
							<p class="label-kecil">MODERASI ADMIN</p>
							<div>
								<button class="produk-nonaktifkan" type="button" onclick={() => moderateProduct('disabled')} disabled={isModerating}>
									{isModerating ? 'Memproses...' : 'Nonaktifkan produk'}
								</button>
								<button class="produk-hapus" type="button" onclick={() => moderateProduct('deleted')} disabled={isModerating}>Hapus produk</button>
							</div>
						</section>
					{/if}
				</div>
			</section>

			{#if shop}
				<section class="bilah-toko">
					<div class="identitas-bilah-toko">
						{#if shop.shop.profile_image_url}
							<img src={shop.shop.profile_image_url} alt={`Foto ${shop.shop.name}`} />
						{:else}
							<span class="contoh-bilah-toko" aria-hidden="true">{shop.shop.name.slice(0, 1).toUpperCase()}</span>
						{/if}
						<div><p class="label-kecil">TOKO PENJUAL</p><h2><a class="tautan-nama-toko" href={`/e-commerce/toko/${shop.shop.id}`}>{shop.shop.name}</a></h2><p>{shop.shop.location}</p></div>
					</div>
					<a class="tautan-toko" href={`/e-commerce/toko/${shop.shop.id}`}>Lihat detail toko <span>↗</span></a>
				</section>
			{/if}

			{#if product.is_pre_order}
				<details class="menu-pilihan-rincian menu-pilihan-cuaca" open>
					<summary>
						<span><span class="logo-sumber">BMKG</span><strong>Prediksi cuaca lahan terkait</strong></span>
					</summary>
					{#if product.weather_forecasts?.length}
						<div class="tab-cuaca">
							<button class:aktif={weatherRange === 'today'} onclick={() => (weatherRange = 'today')}>Beberapa jam</button>
							<button class:aktif={weatherRange === 'tomorrow'} onclick={() => (weatherRange = 'tomorrow')} disabled={!product.weather_forecasts?.slice(4, 8).length}>Hari berikutnya</button>
							<button class:aktif={weatherRange === 'later'} onclick={() => (weatherRange = 'later')} disabled={!product.weather_forecasts?.slice(8, 12).length}>Hari setelahnya</button>
						</div>
						{#if visibleForecasts.length}
							<div class="daftar-cuaca">
								{#each visibleForecasts as weather}
									<div class="baris-cuaca">
										<div><strong>{forecastDate(weather.datetime)}</strong><span>{weather.weather_name}</span></div>
										<div class="utama-cuaca"><strong>{weather.temperature}°C</strong><span>Hujan {weather.precipitation} mm</span></div>
										<div class="informasi-cuaca"><span>💧 {weather.humidity}%</span><span>Angin {weather.wind_speed} km/j</span></div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="redup">Rentang waktu ini belum tersedia pada snapshot analisis lahan.</p>
						{/if}
						<footer class="kaki-halaman-sumber">Data prakiraan cuaca © Badan Meteorologi, Klimatologi, dan Geofisika (BMKG).</footer>
					{:else}
						<p class="redup">Prediksi cuaca lahan belum tersedia dari analisis petani.</p>
					{/if}
				</details>
			{/if}

			<details class="menu-pilihan-rincian menu-pilihan-deskripsi">
				<summary>Deskripsi produk</summary>
				<p>{product.description}</p>
			</details>

			<details bind:this={reviewsDetails} id="ulasan-pembeli" class="bagian-ulasan" aria-labelledby="judul-ulasan">
				<summary class="judul-bagian">
					<div>
						<p class="label-kecil">ULASAN PEMBELI</p>
						<h2 id="judul-ulasan">Ulasan pembeli</h2>
					</div>
					<div class="rata-rata-ulasan">
						{#if productReviews.rating_count > 0}<strong>{productReviews.average_rating.toFixed(1)}</strong>{/if}
						<span class="bintang-ulasan" aria-label={`${productReviews.average_rating} dari 5 bintang`}>
							{'★'.repeat(Math.round(productReviews.average_rating))}{'☆'.repeat(5 - Math.round(productReviews.average_rating))}
						</span>
						<small>{productReviews.rating_count} ulasan</small>
					</div>
				</summary>
				<div class="isi-ulasan">

				{#if reviewNotice}<p class="peringatan-ulasan">{reviewNotice}</p>{/if}
				{#if reviewError}<p class="galat-ulasan">{reviewError}</p>{/if}

				{#if reviewLoading}
					<p class="kosong-ulasan">Memeriksa pesanan yang dapat diberi rating...</p>
				{:else if eligibleReviewOrderIds.length}
					<form class="formulir-ulasan" onsubmit={(event) => { event.preventDefault(); void submitReview(); }}>
						<p class="judul-formulir-ulasan">Bagaimana pengalaman belanja Anda?</p>
						<div class="pemilih-penilaian" role="radiogroup" aria-label="Pilih rating bintang">
							{#each Array(5) as _, index}
								<button
									type="button"
									class:terpilih={reviewRating >= index + 1}
									role="radio"
									aria-checked={reviewRating === index + 1}
									aria-label={`${index + 1} bintang`}
									onclick={() => (reviewRating = index + 1)}
								>★</button>
							{/each}
						</div>
						<label class="komentar-ulasan">Ulasan (opsional)
							<textarea bind:value={reviewComment} maxlength="1000" rows="4" placeholder="Ceritakan kualitas produk dan pengalaman Anda..."></textarea>
						</label>
						<div class="komentar-ulasan"><span>Foto ulasan (opsional)</span>
							<label class="pemilih-foto"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange={handleReviewImageSelection} /><span class="tombol-pemilih-foto">Pilih foto</span><span class="nama-pemilih-foto">{reviewImageFiles.length ? `${reviewImageFiles.length} foto dipilih` : 'Belum ada foto'}</span></label>
							<small>Maksimal 5 foto, JPG/PNG/WebP, maksimal 5 MB per foto.</small>
						</div>
						{#if reviewImagePreviews.length}
							<div class="gambar-ulasan">
								{#each reviewImagePreviews as preview}
									<img src={preview} alt="Preview foto ulasan" />
								{/each}
							</div>
						{/if}
						<button class="kirim-ulasan" type="submit" disabled={reviewSubmitting}>
							{reviewSubmitting ? 'Mengirim...' : 'Kirim ulasan'}
						</button>
					</form>
				{:else if currentUser}
						{#if hasExistingReview}
							<a class="lainnya-ulasan" href={`/e-commerce/${product.id}/rating#review-${currentReviewId}`}>Perbarui ulasan?</a>
						{:else}
							<p class="kosong-ulasan">Rating tersedia setelah pesanan diterima dan dikonfirmasi selesai oleh pembeli serta penjual.</p>
						{/if}
				{:else}
					<p class="kosong-ulasan"><a href="/signin">Masuk</a> untuk memberi rating setelah pesanan selesai.</p>
				{/if}

				{#if productReviews.reviews.length}
					<div class="daftar-ulasan">
						{#each productReviews.reviews.slice(0, 2) as review (review.id)}
							<article class="kartu-ulasan">
								{#if editingReviewId === review.id}
									<form class="formulir-ubah-ulasan" onsubmit={(event) => { event.preventDefault(); void saveProductReview(review.id); }}>
										<div class="baris-penulis-ulasan">
											{#if review.user_image_url}<img src={review.user_image_url} alt="" />{/if}
											<p class="penulis-ulasan">{review.user_email || 'Pembeli'}</p>
										</div>
										<div class="pemilih-penilaian" role="radiogroup" aria-label="Ubah rating bintang">
											{#each Array(5) as _, index}
												<button type="button" class:terpilih={editingReviewRating >= index + 1} role="radio" aria-checked={editingReviewRating === index + 1} aria-label={`${index + 1} bintang`} onclick={() => (editingReviewRating = index + 1)}>★</button>
											{/each}
										</div>
										<label class="komentar-ulasan">Ulasan (opsional)
											<textarea bind:value={editingReviewComment} maxlength="1000" rows="3" placeholder="Ceritakan pengalaman Anda..."></textarea>
										</label>
										<div class="komentar-ulasan"><span>Foto ulasan (opsional)</span>
											<label class="pemilih-foto"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange={(event) => handleReviewImageSelection(event, true)} /><span class="tombol-pemilih-foto">Pilih foto</span><span class="nama-pemilih-foto">{editingReviewImageFiles.length ? `${editingReviewImageFiles.length} foto dipilih` : editingReviewImages.length ? `${editingReviewImages.length} foto tersimpan` : 'Belum ada foto'}</span></label>
											<small>Jika memilih foto baru, foto lama akan diganti.</small>
										</div>
										{#if editingReviewImages.length || editingReviewImagePreviews.length}
											<div class="gambar-ulasan">
												{#each editingReviewImagePreviews.length ? editingReviewImagePreviews : editingReviewImages as image}
													<img src={image} alt="Foto ulasan" />
												{/each}
												{#if editingReviewImages.length && !editingReviewImagePreviews.length}
													<button class="batal-ulasan" type="button" onclick={() => { editingReviewImages = []; editingReviewImagesChanged = true; }}>Hapus foto saat ini</button>
												{/if}
											</div>
										{/if}
										<div class="aksi-ulasan">
											<button class="kirim-ulasan" type="submit" disabled={savingReview}>{savingReview ? 'Menyimpan...' : 'Simpan perubahan'}</button>
											<button class="batal-ulasan" type="button" onclick={() => (editingReviewId = null)} disabled={savingReview}>Batal</button>
										</div>
									</form>
								{:else}
									<div class="baris-penulis-ulasan">
										{#if review.user_image_url}<img src={review.user_image_url} alt="" />{/if}
										<p class="penulis-ulasan">{review.user_email || 'Pembeli'}</p>
									</div>
									<div class="judul-kartu-ulasan">
										<span class="bintang-ulasan">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
										<time datetime={review.createdAt}>{reviewDate(review.createdAt)}</time>
									</div>
									{#if review.image_urls.length}
										<div class="gambar-ulasan">
											{#each review.image_urls as image}
												<img src={image} alt="Foto yang ditambahkan pada ulasan" />
											{/each}
										</div>
									{/if}
									<p class="jumlah-ulang-ulasan">Pembelian terkonfirmasi: {review.repeat_order_count} kali</p>
									<p>{review.comment || 'Pembeli hanya memberikan rating.'}</p>
									{#if currentUser && canManageReview(review.user_id)}
										<div class="aksi-ulasan">
											{#if canEditReview(review.user_id)}
												<button class="batal-ulasan" type="button" onclick={() => startEditingReview(review)}>Ubah ulasan</button>
											{/if}
											<button class="hapus-ulasan" type="button" onclick={() => void removeProductReview(review.id)}>Hapus ulasan</button>
										</div>
									{/if}
								{/if}
							</article>
						{/each}
					</div>
					{#if productReviews.rating_count > 0}
						<a class="lainnya-ulasan" href={`/e-commerce/${product?.id || page.params.id}/rating`}>lihat ulasan lainnya {productReviews.rating_count}</a>
					{/if}
				{:else}
					<p class="kosong-ulasan">Belum ada ulasan untuk produk ini.</p>
				{/if}
				</div>
			</details>

			<section class="produk-lainnya">
				<div class="judul-bagian"><div><p class="label-kecil">REKOMENDASI PRODUK</p><h2>Temukan kebutuhan tani lainnya</h2></div><a href="/e-commerce">Buka semua produk →</a></div>
				{#if recommendedReady.length}
					<h3 class="judul-rekomendasi">Ready Stock</h3>
					<div class="kisi-terkait">
						{#each recommendedReady as item (item.id)}
							<Card product={item} />
						{/each}
					</div>
				{/if}
				{#if recommendedPreOrder.length}
					<h3 class="judul-rekomendasi">Pre-Order</h3>
					<div class="kisi-terkait">
						{#each recommendedPreOrder as item (item.id)}
							<Card product={item} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</div>
</div>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f5f7f0;
		color: #183126;
		padding: 38px 20px 80px;
	}
	.wadah-halaman {
		max-width: 1080px;
		margin: 0 auto;
	}
	.kembali {
		display: inline-block;
		margin-bottom: 28px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.rincian-produk {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 44px;
		align-items: center;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		padding: 24px;
		box-shadow: 0 10px 26px #23472e0a;
	}
	.visual {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 440px;
		overflow: hidden;
		border-radius: 10px;
		background: #dcebd8;
	}
	.visual img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.contoh {
		font-size: 100px;
	}
	.label-kecil {
		margin: 0 0 12px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .15em;
	}
	.isi h1 {
		margin: 0 0 16px;
		font: 600 clamp(36px, 4.7vw, 58px) / 1 'Fraunces', Georgia, serif;
	}
	.harga {
		display: block;
		color: #39754b;
		font-size: 25px;
	}
	.panel-indikator {
		margin-top: 22px;
		border-radius: 8px;
		padding: 16px;
	}
	.panel-pra-pesan {
		background: #fff8eb;
		color: #805a22;
	}
	.panel-siap {
		display: grid;
		gap: 4px;
		background: #edf8ed;
		color: #39754b;
	}
	.judul-indikator, .rincian-indikator {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.judul-indikator span, .rincian-indikator, .panel-siap span, .panel-siap small {
		font-size: 12px;
	}
	.judul-indikator strong, .panel-siap strong {
		font-size: 23px;
	}
	.jalur-kemajuan {
		width: 100%;
		height: 8px;
		margin: 12px 0 9px;
		overflow: hidden;
		border: 0;
		border-radius: 999px;
		background: #ecdcbf;
	}
	.jalur-kemajuan::-webkit-progress-bar {
		border-radius: inherit;
		background: #ecdcbf;
	}
	.jalur-kemajuan::-webkit-progress-value {
		border-radius: inherit;
		background: #a8762e;
	}
	.jalur-kemajuan::-moz-progress-bar {
		border-radius: inherit;
		background: #a8762e;
	}
	.panen {
		margin: 10px 0 0;
		color: #718077;
		font-size: 12px;
	}
	.baris-beli {
		display: flex;
		align-items: end;
		gap: 12px;
		margin-top: 28px;
		flex-wrap: wrap;
	}
	.baris-beli label {
		display: grid;
		gap: 7px;
		color: #52705a;
		font-size: 11px;
		font-weight: 700;
	}
	.kontrol-jumlah {
		display: flex;
		height: 44px;
		border: 1px solid #b7d0b6;
		border-radius: 7px;
		overflow: hidden;
		background: #fff;
	}
	.kontrol-jumlah button {
		width: 38px;
		border: 0;
		background: #f3f8f1;
		color: #39754b;
		font-size: 19px;
		cursor: pointer;
	}
	.kontrol-jumlah button:disabled {
		color: #9aaa9c;
		cursor: not-allowed;
	}
	.kontrol-jumlah input {
		width: 48px;
		border: 0;
		border-right: 1px solid #e1e9df;
		border-left: 1px solid #e1e9df;
		border-radius: 0;
		padding: 8px 3px;
		background: #fff;
		font: 700 13px 'DM Sans', sans-serif;
		text-align: center;
		appearance: textfield;
	}
	.kontrol-jumlah input::-webkit-inner-spin-button, .kontrol-jumlah input::-webkit-outer-spin-button {
		appearance: none;
		margin: 0;
	}
	.aksi-pembelian {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.aksi-pembelian button {
		min-height: 44px;
		border-radius: 7px;
		padding: 12px 15px;
		font: 700 12px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.aksi-pembelian button:disabled {
		opacity: .6;
		cursor: not-allowed;
	}
	.aksi-keranjang {
		border: 1px solid #39754b;
		background: #fff;
		color: #39754b;
	}
	.aksi-sekarang-beli {
		border: 1px solid #39754b;
		background: #39754b;
		color: #fff;
	}
	.peringatan, .keadaan {
		margin-top: 18px;
		border-radius: 7px;
		padding: 13px;
		background: #edf8ed;
		color: #39754b;
		font-size: 13px;
	}
	.peringatan a {
		color: #39754b;
		font-weight: 800;
	}
	.peringatan.galat, .keadaan.galat {
		background: #fff0ef;
		color: #a44242;
	}
	.keadaan {
		border: 1px solid #d6e1d5;
		background: #fff;
		text-align: center;
	}
	.moderasi-admin {
		display: grid;
		gap: 9px;
		margin-top: 22px;
		border-top: 1px solid #d6e1d5;
		padding-top: 17px;
	}
	.moderasi-admin .label-kecil {
		margin: 0;
	}
	.moderasi-admin > div {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
	}
	.moderasi-admin button {
		min-height: 38px;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fff;
		color: #385540;
		padding: 9px 12px;
		font: 700 12px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.moderasi-admin .produk-nonaktifkan {
		border-color: #e6d4a9;
		background: #fff8e7;
		color: #946b26;
	}
	.moderasi-admin .produk-hapus {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	.moderasi-admin button:disabled {
		opacity: .6;
		cursor: wait;
	}
	.bilah-toko {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-top: 22px;
		border-top: 1px solid #d6e1d5;
		border-bottom: 1px solid #d6e1d5;
		padding: 24px 4px;
	}
	.identitas-bilah-toko {
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}
	.identitas-bilah-toko > img, .contoh-bilah-toko {
		display: grid;
		place-items: center;
		width: 58px;
		height: 58px;
		flex: 0 0 auto;
		border: 1px solid #b8d4b8;
		border-radius: 50%;
		background: #eaf4e9;
		color: #39754b;
		font-size: 20px;
		font-weight: 800;
		object-fit: cover;
	}
	.identitas-bilah-toko > div {
		min-width: 0;
	}
	.bilah-toko h2, .judul-bagian h2 {
		margin: 0;
		font: 600 28px / 1.1 'Fraunces', Georgia, serif;
	}
	.tautan-nama-toko {
		color: inherit;
		text-decoration: none;
	}
	.tautan-nama-toko:hover {
		color: #39754b;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.tautan-nama-toko:focus-visible {
		border-radius: 3px;
		outline: 2px solid #39754b;
		outline-offset: 3px;
	}
	.bilah-toko p:not(.label-kecil) {
		margin: 8px 0 0;
		color: #718077;
		font-size: 13px;
	}
	.tautan-toko, .judul-bagian a {
		color: #39754b;
		font-size: 13px;
		font-weight: 800;
		text-decoration: none;
	}
	.tautan-toko span {
		font-size: 18px;
	}
	.bagian-ulasan {
		display: block;
		margin-top: 22px;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 24px;
	}
	.bagian-ulasan > summary {
		position: relative;
		align-items: center;
		margin: 0;
		padding-right: 30px;
		cursor: pointer;
		list-style: none;
	}
	.bagian-ulasan > summary::-webkit-details-marker {
		display: none;
	}
	.bagian-ulasan > summary::after {
		position: absolute;
		top: 50%;
		right: 0;
		color: #39754b;
		content: '+';
		font-size: 24px;
		font-weight: 500;
		line-height: 1;
		transform: translateY(-50%);
	}
	.bagian-ulasan[open] > summary::after {
		display: none;
	}
	.bagian-ulasan > summary:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 5px;
		border-radius: 4px;
	}
	.isi-ulasan {
		border-top: 1px solid #e8eee6;
		padding-top: 16px;
	}
	.rata-rata-ulasan {
		display: grid;
		justify-items: end;
		gap: 2px;
	}
	.rata-rata-ulasan strong {
		color: #183126;
		font-size: 28px;
	}
	.rata-rata-ulasan small, .kartu-ulasan time {
		color: #718077;
		font-size: 11px;
	}
	.bintang-ulasan {
		color: #d49a24;
		letter-spacing: .04em;
		font-size: 20px;
	}
	.formulir-ulasan {
		display: grid;
		gap: 12px;
		margin: 18px 0;
		border: 1px solid #e5ede3;
		border-radius: 8px;
		background: #f9fbf8;
		padding: 16px;
	}
	.judul-formulir-ulasan {
		margin: 0;
		color: #274a32;
		font-size: 14px;
		font-weight: 800;
	}
	.komentar-ulasan {
		display: grid;
		gap: 7px;
		color: #52705a;
		font-size: 12px;
		font-weight: 700;
	}
	.komentar-ulasan textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #cbdacb;
		border-radius: 6px;
		background: #fff;
		color: #183126;
		padding: 10px;
		font: inherit;
	}
	.komentar-ulasan textarea {
		resize: vertical;
		font-size: 13px;
		line-height: 1.5;
	}
	.pemilih-penilaian {
		display: flex;
		gap: 4px;
	}
	.pemilih-penilaian button {
		border: 0;
		background: transparent;
		color: #bfc9bf;
		padding: 2px;
		font-size: 30px;
		cursor: pointer;
	}
	.pemilih-penilaian button.terpilih {
		color: #d49a24;
	}
	.kirim-ulasan {
		justify-self: start;
		min-height: 40px;
		border: 1px solid #39754b;
		border-radius: 6px;
		background: #39754b;
		color: #fff;
		padding: 9px 14px;
		font: 700 12px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.kirim-ulasan:disabled {
		opacity: .6;
		cursor: wait;
	}
	.peringatan-ulasan, .galat-ulasan, .kosong-ulasan {
		border-radius: 6px;
		padding: 12px;
		font-size: 12px;
		line-height: 1.5;
	}
	.peringatan-ulasan {
		background: #edf8ed;
		color: #39754b;
	}
	.galat-ulasan {
		background: #fff0ef;
		color: #a44242;
	}
	.kosong-ulasan {
		color: #718077;
	}
	.kosong-ulasan a {
		color: #39754b;
		font-weight: 800;
	}
	.daftar-ulasan {
		display: grid;
		gap: 10px;
		margin-top: 16px;
	}
	.kartu-ulasan {
		border-top: 1px solid #e8eee6;
		padding: 14px 0 4px;
	}
	.judul-kartu-ulasan {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.penulis-ulasan {
		margin: 0 0 4px;
		color: #829488;
		font-size: 8px;
		font-weight: 500;
		letter-spacing: .01em;
		text-transform: lowercase;
	}
	.jumlah-ulang-ulasan {
		margin: 4px 0 0;
		color: #718077;
		font-size: 10px;
	}
	.kartu-ulasan p {
		margin: 8px 0 0;
		color: #53665a;
		font-size: 13px;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.formulir-ubah-ulasan {
		display: grid;
		gap: 9px;
	}
	.aksi-ulasan {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}
	.hapus-ulasan, .batal-ulasan {
		min-height: 34px;
		border: 1px solid #b8d3b7;
		border-radius: 6px;
		background: #edf8ed;
		color: #39754b;
		padding: 7px 11px;
		font: 700 11px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.hapus-ulasan {
		border-color: #e7c3bf;
		background: #fff7f6;
		color: #a44242;
	}
	.hapus-ulasan:hover {
		background: #fff0ef;
	}
	.batal-ulasan:disabled, .hapus-ulasan:disabled {
		opacity: .6;
		cursor: wait;
	}
	.lainnya-ulasan {
		display: inline-block;
		margin-top: 16px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.produk-lainnya {
		padding-top: 42px;
	}
	.judul-bagian {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 18px;
	}
	.kisi-terkait {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}
	.menu-pilihan-rincian {
		margin-top: 18px;
		border: 1px solid #d6e1d5;
		border-radius: 9px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e08;
	}
	.menu-pilihan-rincian summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		cursor: pointer;
		list-style: none;
		padding: 18px 20px;
		color: #183126;
		font-size: 14px;
		font-weight: 800;
	}
	.menu-pilihan-rincian summary::-webkit-details-marker {
		display: none;
	}
	.menu-pilihan-rincian summary::after {
		content: '+';
		color: #39754b;
		font-size: 20px;
	}
	.menu-pilihan-rincian[open] summary::after {
		content: '−';
	}
	.menu-pilihan-rincian summary > span {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.menu-pilihan-rincian > p,
			.menu-pilihan-deskripsi > p {
		margin: 0;
		border-top: 1px solid #e8eee6;
		padding: 18px 20px 22px;
		color: #53665a;
		font-size: 14px;
		line-height: 1.75;
	}
	.logo-sumber {
		display: inline-flex;
		align-items: center;
		border-radius: 5px;
		background: #1769aa;
		color: #fff;
		padding: 5px 8px;
		font: 800 10px Arial, sans-serif;
		letter-spacing: .06em;
	}
	.tab-cuaca {
		display: flex;
		gap: 6px;
		border-top: 1px solid #e8eee6;
		padding: 16px 20px 0;
	}
	.tab-cuaca button {
		border: 1px solid #d6e1d5;
		border-radius: 6px;
		background: #f7faf6;
		color: #52705a;
		padding: 8px 9px;
		font-size: 11px;
		cursor: pointer;
	}
	.tab-cuaca button.aktif {
		border-color: #39754b;
		background: #39754b;
		color: #fff;
	}
	.tab-cuaca button:disabled {
		cursor: not-allowed;
		opacity: .45;
	}
	.daftar-cuaca {
		display: grid;
		gap: 9px;
		padding: 12px 20px 0;
	}
	.baris-cuaca {
		display: grid;
		grid-template-columns: 1.2fr .8fr;
		gap: 7px 12px;
		border: 1px solid #e5ede3;
		border-radius: 7px;
		background: #f9fbf8;
		padding: 11px;
	}
	.baris-cuaca strong,
			.baris-cuaca span {
		display: block;
	}
	.baris-cuaca strong {
		color: #274a32;
		font-size: 13px;
	}
	.baris-cuaca span {
		margin-top: 4px;
		color: #718077;
		font-size: 11px;
	}
	.utama-cuaca {
		text-align: right;
	}
	.informasi-cuaca {
		display: flex;
		grid-column: 1 / -1;
		gap: 14px;
		border-top: 1px solid #e8eee6;
		padding-top: 7px;
	}
	.kaki-halaman-sumber {
		margin: 16px 20px 18px;
		color: #829087;
		font-size: 10px;
		line-height: 1.5;
	}
	.judul-rekomendasi {
		margin: 24px 0 12px;
		color: #274a32;
		font-size: 18px;
	}
	@media (max-width: 800px) {
		.rincian-produk {
			grid-template-columns: 1fr;
			gap: 28px;
		}
		.kisi-terkait {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 520px) {
		.kerangka-halaman {
			padding: 24px 14px 60px;
		}
		.rincian-produk {
			padding: 16px;
		}
		.visual {
			min-height: 290px;
		}
		.bilah-toko, .judul-bagian {
			align-items: start;
			flex-direction: column;
		}
		.kisi-terkait {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}
	}
	.baris-penulis-ulasan {
		display: flex;
		align-items: center;
		gap: 7px;
		min-width: 0;
	}
	.baris-penulis-ulasan img {
		width: 25px;
		height: 25px;
		border-radius: 50%;
		object-fit: cover;
	}
	.baris-penulis-ulasan .penulis-ulasan {
		overflow-wrap: anywhere;
	}
	.gambar-ulasan {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}
	.gambar-ulasan img {
		width: 88px;
		height: 88px;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		object-fit: cover;
	}
	.komentar-ulasan small {
		color: #718077;
		font-size: 10px;
		font-weight: 400;
	}
	.pemilih-foto {
		display: flex;
		width: fit-content;
		align-items: center;
		gap: 10px;
		font-weight: 400;
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