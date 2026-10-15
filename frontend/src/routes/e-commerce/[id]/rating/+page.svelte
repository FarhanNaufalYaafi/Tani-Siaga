<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		deleteProductReview,
		getProductById,
		getProductReviews,
		updateProductReview,
		type Product,
		type ProductReviewsResponse
	} from '$lib/api/product-api';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import Pagination from '$lib/components/Pagination.svelte';
	import { showConfirm } from '$lib/services/dialog';
	import { uploadImages } from '$lib/api/media-api';

	const PAGE_SIZE = 10;
	let product = $state<Product | null>(null);
	let currentUser = $state<CurrentUserDto | null>(null);
	let reviews = $state<ProductReviewsResponse>({
		average_rating: 0,
		rating_count: 0,
		reviews: [],
		meta: { page: 1, limit: PAGE_SIZE, total: 0, total_pages: 1 },
	});
	let currentPage = $state(1);
	let loading = $state(true);
	let error = $state('');
	let notice = $state('');
	let editingReviewId = $state<number | null>(null);
	let editRating = $state(0);
	let editComment = $state('');
	let editImages = $state<string[]>([]);
	let editImageFiles = $state<File[]>([]);
	let editImagePreviews = $state<string[]>([]);
	let editImagesChanged = $state(false);
	let savingReview = $state(false);

	let currentUserId = $derived(Number(currentUser?.id ?? currentUser?.userId ?? 0));
	let isAdmin = $derived(currentUser?.role === 'admin');

	async function loadReviews(nextPage = currentPage) {
		loading = true;
		error = '';
		try {
			const productId = page.params.id;
			if (!productId) throw new Error('Produk tidak ditemukan.');
			if (!product) product = await getProductById(productId);
			reviews = await getProductReviews(productId, nextPage, PAGE_SIZE);
			currentPage = reviews.meta.page;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Gagal memuat ulasan pembeli.';
		} finally {
			loading = false;
		}
	}

	function reviewDate(value: string) {
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));
	}

	function canEdit(reviewUserId: number) {
		return currentUserId > 0 && currentUserId === reviewUserId;
	}

	function canDelete(reviewUserId: number) {
		return canEdit(reviewUserId) || isAdmin;
	}

	function startEditing(review: ProductReviewsResponse['reviews'][number]) {
		editingReviewId = review.id;
		editRating = review.rating;
		editComment = review.comment;
		editImages = [...review.image_urls];
		editImagesChanged = false;
		clearImagePreviews(editImagePreviews);
		editImageFiles = [];
		editImagePreviews = [];
		notice = '';
		error = '';
	}

	function clearImagePreviews(previews: string[]) {
		for (const preview of previews) URL.revokeObjectURL(preview);
	}

	function handleImageSelection(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files || []);
		if (files.length > 5) {
			error = 'Pilih maksimal 5 foto ulasan.';
			input.value = '';
			return;
		}
		if (files.some((file) => file.size > 5 * 1024 * 1024)) {
			error = 'Ukuran setiap foto ulasan maksimal 5 MB.';
			input.value = '';
			return;
		}
		clearImagePreviews(editImagePreviews);
		editImageFiles = files;
		editImagePreviews = files.map((file) => URL.createObjectURL(file));
		editImagesChanged = true;
		error = '';
	}

	async function saveReview(reviewId: number) {
		if (!product || editRating < 1 || editRating > 5) {
			error = 'Pilih rating bintang 1 sampai 5.';
			return;
		}
		savingReview = true;
		error = '';
		notice = '';
		try {
			const imageUrls = editImageFiles.length
				? await uploadImages(editImageFiles, 'review')
				: editImagesChanged
					? editImages
					: undefined;
			await updateProductReview(product.id, reviewId, {
				rating: editRating,
				comment: editComment.trim(),
				...(imageUrls !== undefined ? { image_urls: imageUrls } : {}),
			});
			editingReviewId = null;
			clearImagePreviews(editImagePreviews);
			editImageFiles = [];
			editImagePreviews = [];
			notice = 'Ulasan berhasil diperbarui.';
			await loadReviews(currentPage);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Gagal memperbarui ulasan.';
		} finally {
			savingReview = false;
		}

		onDestroy(() => clearImagePreviews(editImagePreviews));
	}

	async function removeReview(reviewId: number) {
		if (!product) return;
		const confirmed = await showConfirm('Ulasan yang dihapus tidak dapat dipulihkan.', {
			title: 'Hapus ulasan?',
			confirmLabel: 'Hapus ulasan',
			tone: 'error',
		});
		if (!confirmed) return;

		error = '';
		notice = '';
		try {
			await deleteProductReview(product.id, reviewId);
			notice = 'Ulasan berhasil dihapus.';
			const pageAfterDelete = reviews.reviews.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
			await loadReviews(pageAfterDelete);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Gagal menghapus ulasan.';
		}
	}

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
		} catch {
			currentUser = null;
		}
		await loadReviews(1);
	});
</script>

<svelte:head>
	<title>Ulasan Pembeli | Tani Siaga</title>
</svelte:head>

<div class="kerangka-halaman">
	<div class="wadah-halaman">
		<a class="kembali" href={product ? `/e-commerce/${product.id}` : '/e-commerce'}>← Kembali ke produk</a>

		{#if loading && !product}
			<div class="keadaan">Memuat ulasan pembeli...</div>
		{:else if error && !product}
			<div class="keadaan galat">{error}</div>
		{:else if product}
			<section class="kartu-bilah">
				<p class="label-kecil">ULASAN PEMBELI</p>
				<h1 class="judul">{product.name}</h1>
				<div class="ringkasan">
					<span class="bintang-ringkasan">{'★'.repeat(Math.round(reviews.average_rating))}{'☆'.repeat(5 - Math.round(reviews.average_rating))}</span>
					<strong>{reviews.average_rating ? reviews.average_rating.toFixed(1) : '0.0'} / 5</strong>
					<span>{reviews.rating_count} ulasan</span>
				</div>
			</section>

			{#if notice}<p class="peringatan">{notice}</p>{/if}
			{#if error}<p class="pesan-galat">{error}</p>{/if}
			{#if loading}
				<div class="keadaan">Memuat halaman ulasan...</div>
			{:else if reviews.reviews.length}
				<div class="daftar-ulasan">
					{#each reviews.reviews as review (review.id)}
						<article id={`review-${review.id}`} class="kartu-ulasan">
							{#if editingReviewId === review.id}
								<form class="formulir-ubah" onsubmit={(event) => { event.preventDefault(); void saveReview(review.id); }}>
									<label class="label-bidang">Rating produk
										<div class="pemilih-penilaian" role="radiogroup" aria-label="Ubah rating bintang">
											{#each Array(5) as _, index}
												<button
													type="button"
													class:terpilih={editRating >= index + 1}
													role="radio"
													aria-checked={editRating === index + 1}
													aria-label={`${index + 1} bintang`}
													onclick={() => (editRating = index + 1)}
												>★</button>
											{/each}
										</div>
									</label>
									<label class="label-bidang">Ulasan (opsional)
										<textarea bind:value={editComment} maxlength="1000" rows="4" placeholder="Ceritakan pengalaman Anda..."></textarea>
									</label>
									<div class="label-bidang">Foto ulasan (opsional)
										<label class="pemilih-foto"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange={handleImageSelection} /><span class="tombol-pemilih-foto">Pilih foto</span><span class="nama-pemilih-foto">{editImageFiles.length ? `${editImageFiles.length} foto dipilih` : editImages.length ? `${editImages.length} foto tersimpan` : 'Belum ada foto'}</span></label>
										<small>Jika memilih foto baru, foto lama akan diganti.</small>
									</div>
									{#if editImages.length || editImagePreviews.length}
										<div class="gambar-ulasan">
											{#each editImagePreviews.length ? editImagePreviews : editImages as image}
												<img src={image} alt="Foto ulasan" />
											{/each}
											{#if editImages.length && !editImagePreviews.length}
												<button class="tombol-pendukung" type="button" onclick={() => { editImages = []; editImagesChanged = true; }}>Hapus foto saat ini</button>
											{/if}
										</div>
									{/if}
									<div class="aksi-ulasan">
										<button class="tombol-utama" type="submit" disabled={savingReview}>{savingReview ? 'Menyimpan...' : 'Simpan perubahan'}</button>
										<button class="tombol-pendukung" type="button" onclick={() => (editingReviewId = null)} disabled={savingReview}>Batal</button>
									</div>
								</form>
							{:else}
								<div class="baris-pengulas">
									{#if review.user_image_url}<img src={review.user_image_url} alt="" />{/if}
									<p class="pengulas">{review.user_email || 'Pembeli'}</p>
								</div>
								<div class="baris-ulasan">
									<span class="bintang">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
									<time datetime={review.createdAt}>{reviewDate(review.createdAt)}</time>
								</div>
								{#if review.image_urls.length}
									<div class="gambar-ulasan">
										{#each review.image_urls as image}
											<img src={image} alt="Foto yang ditambahkan pada ulasan" />
										{/each}
									</div>
								{/if}
								<p class="jumlah-ulang">Pembelian terkonfirmasi: {review.repeat_order_count} kali</p>
								<p class="komentar">{review.comment || 'Pembeli hanya memberikan rating.'}</p>
								{#if canDelete(review.user_id)}
									<div class="aksi-ulasan">
										{#if canEdit(review.user_id)}
											<button class="tombol-pendukung" type="button" onclick={() => startEditing(review)}>Ubah ulasan</button>
										{/if}
										<button class="tombol-hapus" type="button" onclick={() => void removeReview(review.id)}>Hapus ulasan</button>
									</div>
								{/if}
							{/if}
						</article>
					{/each}
				</div>
				<Pagination
					page={reviews.meta.page}
					totalPages={reviews.meta.total_pages}
					onPageChange={(nextPage) => void loadReviews(nextPage)}
					disabled={loading}
				/>
			{:else}
				<div class="keadaan">Belum ada ulasan untuk produk ini.</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: radial-gradient(ellipse at 50% 0, #e7f2e5 0, #f1f6ed 38%, #f5f7f0 78%);
		padding: 38px 20px 80px;
		color: #183126;
	}
	.wadah-halaman {
		max-width: 960px;
		margin: 0 auto;
	}
	.kembali {
		display: inline-block;
		margin-bottom: 20px;
		color: #39754b;
		font-size: 13px;
		font-weight: 800;
		text-decoration: none;
	}
	.kembali:hover {
		color: #183126;
	}
	.kartu-bilah {
		position: relative;
		overflow: hidden;
		border: 1px solid #a9c9aa;
		border-radius: 14px;
		background: linear-gradient(130deg, #183f2a, #2f7044 68%, #448253);
		padding: 28px 30px;
		color: #fff;
		box-shadow: 0 14px 35px #173d2825;
	}
	.kartu-bilah::after {
		position: absolute;
		right: -30px;
		bottom: -110px;
		width: 260px;
		height: 260px;
		border: 1px solid #ffffff25;
		border-radius: 50%;
		content: '';
		box-shadow: 0 0 0 28px #ffffff0a, 0 0 0 58px #ffffff08;
	}
	.label-kecil {
		margin: 0 0 10px;
		color: #cbe7c9;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.15em;
	}
	.kartu-bilah h1 {
		position: relative;
		z-index: 1;
		margin: 0;
		font: 600 clamp(30px, 5vw, 48px) / 1.1 'Fraunces', Georgia, serif;
	}
	.ringkasan {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-top: 16px;
		color: #e9f5e7;
		font-size: 13px;
	}
	.bintang-ringkasan {
		color: #ffd16a;
		letter-spacing: 0.05em;
		font-size: 17px;
	}
	.keadaan {
		border: 1px solid #c5ddc3;
		border-radius: 10px;
		background: #fff;
		padding: 20px;
		color: #39754b;
		font-size: 14px;
		box-shadow: 0 8px 20px #23472e0a;
	}
	.keadaan.galat, .pesan-galat {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	.peringatan, .pesan-galat {
		margin: 16px 0 0;
		border: 1px solid #b8d8b6;
		border-radius: 8px;
		background: #eaf5e8;
		padding: 12px 14px;
		color: #27623c;
		font-size: 13px;
	}
	.pesan-galat {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	.daftar-ulasan {
		display: grid;
		gap: 14px;
		margin-top: 20px;
	}
	.kartu-ulasan {
		border: 1px solid #c8ddc6;
		border-left: 4px solid #39754b;
		border-radius: 10px;
		background: linear-gradient(120deg, #fff 0%, #fbfdf9 100%);
		padding: 18px 20px;
		box-shadow: 0 8px 22px #23472e0c;
		scroll-margin-top: 24px;
	}
	.pengulas {
		margin: 0 0 5px;
		color: #829488;
		font-size: 8px;
		font-weight: 500;
		letter-spacing: 0.01em;
		overflow-wrap: anywhere;
	}
	.baris-ulasan {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.bintang, .pemilih-penilaian button {
		color: #d49a24;
		letter-spacing: 0.06em;
		font-size: 21px;
	}
	.komentar {
		margin: 11px 0 0;
		color: #465e4d;
		font-size: 14px;
		line-height: 1.7;
		white-space: pre-wrap;
	}
	.jumlah-ulang {
		margin: 5px 0 0;
		color: #718077;
		font-size: 10px;
	}
	time {
		color: #718077;
		font-size: 11px;
	}
	.formulir-ubah {
		display: grid;
		gap: 13px;
	}
	.label-bidang {
		display: grid;
		gap: 7px;
		color: #315c3c;
		font-size: 12px;
		font-weight: 800;
	}
	.label-bidang textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #bad2b8;
		border-radius: 7px;
		background: #fff;
		padding: 11px;
		color: #183126;
		font: inherit;
		font-size: 13px;
		line-height: 1.5;
		resize: vertical;
	}
	.label-bidang textarea:focus {
		border-color: #39754b;
		outline: 3px solid #39754b22;
	}
	.pemilih-penilaian {
		display: flex;
		gap: 5px;
	}
	.pemilih-penilaian button {
		border: 0;
		background: transparent;
		padding: 2px;
		color: #b8c4b8;
		cursor: pointer;
		font-size: 28px;
	}
	.pemilih-penilaian button.terpilih {
		color: #d49a24;
	}
	.aksi-ulasan {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 14px;
	}
	.tombol-utama, .tombol-pendukung, .tombol-hapus {
		min-height: 36px;
		border: 1px solid #39754b;
		border-radius: 6px;
		background: #39754b;
		color: #fff;
		padding: 8px 12px;
		font: 700 12px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.tombol-pendukung {
		background: #f0f7ee;
		color: #39754b;
	}
	.tombol-hapus {
		border-color: #c97b75;
		background: #fff;
		color: #a44242;
	}
	button:disabled {
		cursor: wait;
		opacity: .6;
	}
	@media (max-width: 600px) {
		.kerangka-halaman {
			padding: 26px 14px 55px;
		}
		.kartu-bilah {
			padding: 22px 20px;
		}
		.ringkasan {
			align-items: flex-start;
			flex-direction: column;
			gap: 4px;
		}
		.kartu-ulasan {
			padding: 15px;
		}
	}
	.baris-pengulas {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.baris-pengulas img {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		object-fit: cover;
	}
	.baris-pengulas .pengulas {
		overflow-wrap: anywhere;
	}
	.gambar-ulasan {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 9px;
		margin-top: 12px;
	}
	.gambar-ulasan img {
		width: 110px;
		height: 110px;
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		object-fit: cover;
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
	.label-bidang small {
		color: #718077;
		font-size: 10px;
		font-weight: 400;
	}
</style>
