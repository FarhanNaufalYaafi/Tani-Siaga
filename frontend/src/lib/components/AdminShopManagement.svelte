<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		approveShop,
		deleteShopByAdmin,
		getAdminShopDashboard,
		getAdminShops,
		liftShopSanction,
		reactivateProductByAdmin,
		reduceShopSanction,
		rejectShop,
		sanctionShop,
		warnShop,
		type AdminShopApproval,
		type AdminShopDashboard,
	} from '$lib/api/admin-api';
	import Pagination from '$lib/components/Pagination.svelte';
	import Card from '$lib/components/Card.svelte';
	import type { Product } from '$lib/api/product-api';
	import { showAlert, showConfirm, showInput } from '$lib/services/dialog';
	import { uploadImages } from '$lib/api/media-api';

	let items = $state<AdminShopApproval[]>([]);
	let page = $state(1);
	let totalPages = $state(1);
	let total = $state(0);
	let search = $state('');
	let loading = $state(true);
	let errorMessage = $state('');
	let selectedDashboard = $state<AdminShopDashboard | null>(null);
	let isLoadingDashboard = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let moderationForm = $state<{
		shop: AdminShopApproval;
		type: 'warning' | 'sanction';
		reason: string;
		durationDays: number;
		files: File[];
		previews: string[];
		saving: boolean;
		error: string;
	} | null>(null);
	const pageSize = 8;

	async function loadData() {
		loading = true;
		errorMessage = '';
		try {
			const result = await getAdminShops(page, pageSize, search);
			items = result.data;
			total = result.meta.total;
			totalPages = result.meta.total_pages;
			if (page > totalPages && totalPages > 0) {
				page = totalPages;
				await loadData();
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memuat daftar toko.';
		} finally {
			loading = false;
		}
	}

	function onSearch() {
		if (searchTimer) clearTimeout(searchTimer);
		page = 1;
		searchTimer = setTimeout(() => void loadData(), 250);
	}

	async function handleApprove(shop: AdminShopApproval) {
		try {
			await approveShop(shop.id);
			await loadData();
		} catch (error) {
			await showAlert(error instanceof Error ? error.message : 'Gagal menyetujui toko.', { title: 'Aksi gagal', tone: 'error' });
		}
	}

	async function handleReject(shop: AdminShopApproval) {
		const reason = await showInput({
			title: 'Tolak toko',
			message: 'Berikan alasan penolakan untuk disampaikan kepada pemilik toko.',
			input: { label: 'Alasan penolakan', value: 'Data toko belum lengkap.', placeholder: 'Tulis alasan penolakan' },
			confirmLabel: 'Tolak toko',
			tone: 'warning',
		});
		if (reason === null) return;
		try {
			await rejectShop(shop.id, reason.trim() || undefined);
			await loadData();
		} catch (error) {
			await showAlert(error instanceof Error ? error.message : 'Gagal menolak toko.', { title: 'Aksi gagal', tone: 'error' });
		}
	}

	async function handleWarn(shop: AdminShopApproval) {
		openModerationForm(shop, 'warning');
	}

	async function handleSanction(shop: AdminShopApproval) {
		openModerationForm(shop, 'sanction');
	}

	function openModerationForm(shop: AdminShopApproval, type: 'warning' | 'sanction') {
		moderationForm = { shop, type, reason: '', durationDays: 7, files: [], previews: [], saving: false, error: '' };
	}

	function handleEvidenceSelection(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (!moderationForm) return;
		const files = Array.from(input.files || []);
		if (files.length > 4) {
			moderationForm.error = 'Pilih maksimal 4 foto bukti.';
			input.value = '';
			return;
		}
		if (files.some((file) => file.size > 5 * 1024 * 1024)) {
			moderationForm.error = 'Ukuran setiap foto bukti maksimal 5 MB.';
			input.value = '';
			return;
		}
		clearModerationPreviews();
		moderationForm.files = files;
		moderationForm.previews = files.map((file) => URL.createObjectURL(file));
		moderationForm.error = '';
	}

	function clearModerationPreviews() {
		for (const preview of moderationForm?.previews || []) URL.revokeObjectURL(preview);
	}

	function closeModerationForm() {
		clearModerationPreviews();
		moderationForm = null;
	}

	async function submitModerationForm(event: SubmitEvent) {
		event.preventDefault();
		if (!moderationForm) return;
		if (!moderationForm.reason.trim()) {
			moderationForm.error = 'Alasan wajib diisi.';
			return;
		}
		if (moderationForm.type === 'sanction' && (!Number.isInteger(moderationForm.durationDays) || moderationForm.durationDays < 1 || moderationForm.durationDays > 365)) {
			moderationForm.error = 'Durasi sanksi harus 1 sampai 365 hari.';
			return;
		}
		moderationForm.saving = true;
		moderationForm.error = '';
		try {
			const evidenceUrls = moderationForm.files.length
				? await uploadImages(moderationForm.files, 'moderation')
				: [];
			const { shop, type, reason, durationDays } = moderationForm;
			if (type === 'warning') await warnShop(shop.id, reason.trim(), evidenceUrls);
			else await sanctionShop(shop.id, reason.trim(), durationDays, evidenceUrls);
			closeModerationForm();
			await loadData();
		} catch (error) {
			if (moderationForm) {
				moderationForm.error = error instanceof Error ? error.message : 'Gagal menyimpan tindakan moderasi.';
				moderationForm.saving = false;
			}
		}
	}

	async function handleLiftSanction(shop: AdminShopApproval) {
		const confirmed = await showConfirm(`Cabut sanksi toko "${shop.name}" sekarang? Toko dan produk akan kembali ke status sebelum sanksi.`, {
			title: 'Hapus sanksi?',
			confirmLabel: 'Hapus sanksi',
			tone: 'warning',
		});
		if (!confirmed) return;
		try {
			await liftShopSanction(shop.id);
			await loadData();
		} catch (error) {
			await showAlert(error instanceof Error ? error.message : 'Gagal menghapus sanksi.', { title: 'Aksi gagal', tone: 'error' });
		}
	}

	async function handleReduceSanction(shop: AdminShopApproval) {
		const daysInput = await showInput({
			title: 'Kurangi durasi sanksi',
			message: `Sanksi saat ini berakhir ${new Date(shop.banned_until!).toLocaleDateString('id-ID')}.`,
			input: { label: 'Kurangi berapa hari?', type: 'number', min: 1, step: 1, value: '1', required: true },
			confirmLabel: 'Kurangi sanksi',
			tone: 'warning',
		});
		if (daysInput === null) return;
		try {
			await reduceShopSanction(shop.id, Number(daysInput));
			await loadData();
		} catch (error) {
			await showAlert(error instanceof Error ? error.message : 'Gagal mengurangi durasi sanksi.', { title: 'Aksi gagal', tone: 'error' });
		}
	}

	async function handleDelete(shop: AdminShopApproval) {
		const confirmed = await showConfirm(`Toko "${shop.name}" dan semua produknya akan dinonaktifkan.`, {
			title: 'Hapus toko?',
			confirmLabel: 'Hapus toko',
			tone: 'error',
		});
		if (!confirmed) return;
		try {
			await deleteShopByAdmin(shop.id);
			await loadData();
		} catch (error) {
			await showAlert(error instanceof Error ? error.message : 'Gagal menghapus toko.', { title: 'Aksi gagal', tone: 'error' });
		}
	}

	function isCurrentlyBanned(shop: AdminShopApproval) {
		return Boolean(shop.banned_until && new Date(shop.banned_until).getTime() > Date.now());
	}

	function statusLabel(shop: AdminShopApproval) {
		if (isCurrentlyBanned(shop)) return 'Disanksi sementara';
		if (shop.approval_status === 'pending') return 'Menunggu';
		if (shop.approval_status === 'rejected') return 'Ditolak';
		return shop.is_active ? 'Aktif' : 'Nonaktif';
	}

	async function openDashboard(shop: AdminShopApproval) {
		isLoadingDashboard = true;
		try {
			const result = await getAdminShopDashboard(shop.id);
			selectedDashboard = result.data;
		} catch (error) {
			await showAlert(error instanceof Error ? error.message : 'Gagal memuat dashboard toko.', { title: 'Tidak dapat membuka toko', tone: 'error' });
		} finally {
			isLoadingDashboard = false;
		}
	}

	function productStatusLabel(status: AdminShopApproval['approval_status']) {
		if (status === 'approved') return 'Disetujui';
		if (status === 'pending') return 'Pending';
		return 'Ditolak';
	}

	function productAdminStatusLabel(product: AdminShopDashboard['products'][number]) {
		if (product.admin_action === 'deleted') return 'Dihapus admin';
		if (product.admin_action === 'disabled') return 'Nonaktif admin';
		return productStatusLabel(product.approval_status);
	}

	function productCardData(product: AdminShopDashboard['products'][number]): Product {
		return {
			...product,
			farmland: product.farmland
				? {
					id: product.farmland.id,
					name: product.farmland.commodity?.name || 'Lahan tani',
					commodity: product.farmland.commodity,
				}
				: null,
			shop: selectedDashboard
				? { id: selectedDashboard.shop.id, name: selectedDashboard.shop.name, location: selectedDashboard.shop.location }
				: undefined,
		};
	}

	async function handleReactivateProduct(product: AdminShopDashboard['products'][number]) {
		if (!selectedDashboard) return;
		const confirmed = await showConfirm(`Aktifkan kembali produk "${product.name}" dan tampilkan di katalog publik?`, {
			title: 'Aktifkan kembali produk?',
			confirmLabel: 'Aktifkan kembali',
			tone: 'success',
		});
		if (!confirmed) return;
		try {
			await reactivateProductByAdmin(product.id);
			const result = await getAdminShopDashboard(selectedDashboard.shop.id);
			selectedDashboard = result.data;
			await showAlert('Produk aktif kembali dan tampil di katalog publik.', { title: 'Produk diaktifkan', tone: 'success' });
		} catch (error) {
			await showAlert(error instanceof Error ? error.message : 'Gagal mengaktifkan kembali produk.', { title: 'Aksi gagal', tone: 'error' });
		}
	}

	onMount(() => void loadData());
	onDestroy(() => clearModerationPreviews());
</script>

<div class="kerangka-halaman">
	{#if isLoadingDashboard}
		<div class="keadaan">Memuat dashboard toko...</div>
	{:else if selectedDashboard}
		<button class="tombol-kembali" type="button" onclick={() => (selectedDashboard = null)}>← Kembali ke daftar toko</button>
		<header class="judul-dasbor">
			<div>
				<p class="label-kecil">DASHBOARD TOKO · ADMIN</p>
				<h1 class="judul">{selectedDashboard.shop.name}</h1>
				<p class="subjudul">{selectedDashboard.shop.location} · {selectedDashboard.shop.phone_number}</p>
			</div>
			<span class="status" class:menunggu={selectedDashboard.shop.approval_status === 'pending'} class:ditolak={selectedDashboard.shop.approval_status === 'rejected'} class:dikenai={isCurrentlyBanned(selectedDashboard.shop)}>{statusLabel(selectedDashboard.shop)}</span>
		</header>
		{#if selectedDashboard.shop.ban_reason && isCurrentlyBanned(selectedDashboard.shop)}
			<p class="teks-peringatan catatan-sanksi">Sanksi sampai {new Date(selectedDashboard.shop.banned_until!).toLocaleDateString('id-ID')}: {selectedDashboard.shop.ban_reason}</p>
		{/if}
		<section class="kisi-ringkasan">
			<div><span>Total produk</span><strong>{selectedDashboard.stats.total_products}</strong></div>
			<div><span>Disetujui</span><strong>{selectedDashboard.stats.approved_products}</strong></div>
			<div><span>Pending</span><strong>{selectedDashboard.stats.pending_products}</strong></div>
			<div><span>Ditolak</span><strong>{selectedDashboard.stats.rejected_products}</strong></div>
		</section>
		<section class="bagian-produk">
			<div class="judul-bagian"><h2>Produk toko</h2><span>{selectedDashboard.products.length} produk</span></div>
			{#if selectedDashboard.products.length === 0}
				<div class="keadaan">Toko ini belum memiliki produk.</div>
			{:else}
				<div class="produk-dasbor">
					{#each selectedDashboard.products as product (product.id)}
						<div class="produk-dasbor-admin">
							<Card
								product={productCardData(product)}
								linkEnabled={selectedDashboard.shop.approval_status === 'approved' && selectedDashboard.shop.is_active && product.approval_status === 'approved' && product.is_active}
								actionHref={`/e-commerce/${product.id}`}
								statusLabel={productAdminStatusLabel(product)}
								statusTone={product.admin_action || product.approval_status}
							/>
							{#if product.admin_action === 'disabled'}
								<button class="produk-aktifkan" type="button" onclick={() => handleReactivateProduct(product)}>Aktifkan kembali</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{:else}
	<header class="judul">
		<div>
			<p class="label-kecil">ADMIN</p>
			<h1 class="judul">Kelola toko</h1>
			<p class="subjudul">Cari toko, tinjau pendaftaran, dan kelola tindakan moderasi.</p>
		</div>
	</header>

	<div class="bilah">
		<input bind:value={search} oninput={onSearch} placeholder="Cari nama toko, lokasi, atau kontak..." type="search" aria-label="Cari seluruh toko" />
		<span>{total} toko</span>
	</div>

	{#if loading}
		<div class="keadaan">Memuat daftar toko...</div>
	{:else if errorMessage}
		<div class="keadaan galat">{errorMessage}</div>
	{:else if items.length === 0}
		<div class="keadaan">{search ? 'Toko tidak ditemukan.' : 'Belum ada toko terdaftar.'}</div>
	{:else}
		<div class="kisi">
			{#each items as shop (shop.id)}
				<article class="kartu-toko">
					<div class="judul-kartu">
						<div class="penanda-toko" aria-hidden="true">{#if shop.profile_image_url}<img src={shop.profile_image_url} alt="" />{:else}TS{/if}</div>
						<div class="judul-toko">
							<h2><button class="buka-toko" type="button" onclick={() => openDashboard(shop)}>{shop.name}<span aria-hidden="true">↗</span></button></h2>
							<p>{shop.location || 'Lokasi belum diisi'}</p>
						</div>
						<span class="status" class:menunggu={shop.approval_status === 'pending'} class:ditolak={shop.approval_status === 'rejected'} class:dikenai={isCurrentlyBanned(shop)}>{statusLabel(shop)}</span>
					</div>
					<details class="menu-pilihan-deskripsi">
						<summary>Lihat deskripsi toko</summary>
						<p>{shop.description || 'Tidak ada deskripsi toko.'}</p>
					</details>
					<div class="rincian">
						<span>Kontak<strong>{shop.phone_number || '—'}</strong></span>
						<span>Terdaftar<strong>{new Date(shop.created_at).toLocaleDateString('id-ID')}</strong></span>
					</div>
					{#if isCurrentlyBanned(shop)}
						<p class="teks-peringatan catatan-sanksi">Sanksi sampai {new Date(shop.banned_until!).toLocaleDateString('id-ID')}: {shop.ban_reason}</p>
						{#if shop.ban_evidence_urls?.length}<div class="daftar-bukti">{#each shop.ban_evidence_urls as image}<a href={image} target="_blank" rel="noopener noreferrer"><img src={image} alt="Bukti foto sanksi toko" /></a>{/each}</div>{/if}
					{:else if shop.warning_reason}
						<p class="teks-peringatan">Peringatan terakhir: {shop.warning_reason}</p>
						{#if shop.warning_evidence_urls?.length}<div class="daftar-bukti">{#each shop.warning_evidence_urls as image}<a href={image} target="_blank" rel="noopener noreferrer"><img src={image} alt="Bukti foto peringatan toko" /></a>{/each}</div>{/if}
					{/if}
					<div class="aksi">
						{#if shop.approval_status === 'pending'}
							<button class="utama" type="button" onclick={() => handleApprove(shop)}>Setujui</button>
							<button class="pendukung" type="button" onclick={() => handleReject(shop)}>Tolak</button>
						{:else if shop.approval_status === 'approved' && !isCurrentlyBanned(shop)}
							<button class="pendukung" type="button" onclick={() => handleWarn(shop)}>Peringatkan</button>
							<button class="tombol-peringatan" type="button" onclick={() => handleSanction(shop)}>Beri sanksi</button>
						{:else if shop.approval_status === 'approved' && isCurrentlyBanned(shop)}
							<button class="tombol-peringatan" type="button" onclick={() => handleSanction(shop)}>Beri sanksi tambahan</button>
							<button class="sanksi-kurangi" type="button" onclick={() => handleReduceSanction(shop)}>Kurangi sanksi</button>
							<button class="sanksi-naikkan" type="button" onclick={() => handleLiftSanction(shop)}>Hapus sanksi</button>
						{/if}
						<button class="bahaya" type="button" onclick={() => handleDelete(shop)}>Hapus toko</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
	<Pagination {page} {totalPages} onPageChange={(nextPage) => { page = nextPage; void loadData(); }} disabled={loading} />
	{/if}
	{#if moderationForm}
		<div class="latar-dialog">
			<dialog open class="dialog-moderasi" aria-labelledby="judul-moderasi">
				<form onsubmit={submitModerationForm}>
					<p class="label-kecil">MODERASI TOKO</p>
					<h2 id="judul-moderasi">{moderationForm.type === 'warning' ? 'Beri peringatan' : isCurrentlyBanned(moderationForm.shop) ? 'Beri sanksi tambahan' : 'Beri sanksi'} · {moderationForm.shop.name}</h2>
					<p class="bantuan-dialog">{moderationForm.type === 'warning' ? 'Alasan dan foto bukti akan disampaikan kepada pemilik toko.' : `Toko dan produk dinonaktifkan sementara. Maksimal 365 hari.${isCurrentlyBanned(moderationForm.shop) ? ` Durasi tambahan dihitung dari ${new Date(moderationForm.shop.banned_until!).toLocaleDateString('id-ID')}.` : ''}`}</p>
					<label>Alasan
						<textarea bind:value={moderationForm.reason} required maxlength="2000" rows="4" placeholder="Jelaskan alasan tindakan moderasi"></textarea>
					</label>
					{#if moderationForm.type === 'sanction'}
						<label>Durasi sanksi (hari)
							<input type="number" bind:value={moderationForm.durationDays} min="1" max="365" step="1" required />
						</label>
					{/if}
					<div class="bidang-dialog">Foto bukti (opsional)
						<label class="pemilih-foto"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange={handleEvidenceSelection} /><span class="tombol-pemilih-foto">Pilih foto</span><span class="nama-pemilih-foto">{moderationForm.files.length ? `${moderationForm.files.length} foto dipilih` : 'Belum ada foto'}</span></label>
						<small>Maksimal 4 foto JPG, PNG, atau WebP; maksimal 5 MB per foto.</small>
					</div>
					{#if moderationForm.previews.length}
						<div class="daftar-bukti">
							{#each moderationForm.previews as image}<img src={image} alt="Preview bukti moderasi" />{/each}
						</div>
					{/if}
					{#if moderationForm.error}<p class="galat-dialog" role="alert">{moderationForm.error}</p>{/if}
					<div class="aksi-dialog">
						<button class="pendukung" type="button" onclick={closeModerationForm} disabled={moderationForm.saving}>Batal</button>
						<button class:tombol-peringatan={moderationForm.type === 'sanction'} class="utama" type="submit" disabled={moderationForm.saving}>{moderationForm.saving ? 'Menyimpan...' : moderationForm.type === 'warning' ? 'Kirim peringatan' : 'Beri sanksi'}</button>
					</div>
				</form>
			</dialog>
		</div>
	{/if}
</div>

<style>
	.kerangka-halaman {
		width: min(100%, 1000px);
		margin: 0 auto;
		padding: 36px 20px 68px;
		color: #183126;
	}
	.judul {
		margin-bottom: 25px;
	}
	.judul-dasbor {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 18px;
		margin: 20px 0 24px;
	}
	.label-kecil {
		margin: 0 0 8px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	h1 {
		margin: 0;
		font: 600 clamp(38px, 6vw, 56px)/1.02 'Fraunces', Georgia, serif;
	}
	.subjudul {
		margin: 12px 0 0;
		color: #718077;
		line-height: 1.6;
	}
	.tombol-kembali {
		border: 0;
		background: transparent;
		color: #39754b;
		padding: 0;
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.kisi-ringkasan {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
		margin-bottom: 28px;
	}
	.kisi-ringkasan > div {
		display: grid;
		gap: 7px;
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #fff;
		padding: 15px;
	}
	.kisi-ringkasan span {
		color: #718077;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}
	.kisi-ringkasan strong {
		color: #183126;
		font-size: 24px;
	}
	.bagian-produk {
		border-top: 1px solid #d6e1d5;
		padding-top: 20px;
	}
	.judul-bagian {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 14px;
	}
	.judul-bagian h2 {
		margin: 0;
		font-size: 19px;
	}
	.judul-bagian > span {
		color: #718077;
		font-size: 12px;
	}
	.produk-dasbor {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: start;
		gap: 14px;
	}
	.produk-dasbor-admin {
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	.produk-aktifkan {
		min-height: 36px;
		border: 1px solid #a9c9aa;
		border-radius: 7px;
		background: #edf8ed;
		color: #39754b;
		padding: 8px 10px;
		font: inherit;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.produk-aktifkan:hover {
		background: #dcefdc;
	}
	.produk-aktifkan:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 2px;
	}
	.bilah {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 17px;
	}
	.bilah input {
		box-sizing: border-box;
		flex: 1;
		min-width: 0;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fff;
		padding: 13px;
		font: inherit;
		outline: 0;
	}
	.bilah input:focus {
		border-color: #39754b;
		box-shadow: 0 0 0 3px #39754b1c;
	}
	.bilah span {
		color: #718077;
		font-size: 13px;
		white-space: nowrap;
	}
	.kisi {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}
	.kartu-toko {
		display: flex;
		min-width: 0;
		min-height: 248px;
		flex-direction: column;
		gap: 15px;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 18px;
		box-shadow: 0 8px 22px #23472e0a;
		transition: transform .18s, border-color .18s, box-shadow .18s, background-color .18s;
	}
	.kartu-toko:hover,
			.kartu-toko:focus-within {
		transform: translateY(-3px);
		border-color: #39754b;
		background: #fcfff9;
		box-shadow: 0 14px 30px #23472e24;
	}
	.judul-kartu {
		display: grid;
		grid-template-columns: 42px minmax(0, 1fr) auto;
		align-items: start;
		gap: 11px;
	}
	.penanda-toko {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: #eaf4e9;
		color: #39754b;
		font-size: 13px;
		font-weight: 800;
	}
	.penanda-toko img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.judul-toko {
		min-width: 0;
	}
	.judul-toko h2 {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		color: #183126;
		font-size: 18px;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow-wrap: anywhere;
	}
	.buka-toko {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 0;
		background: transparent;
		color: inherit;
		padding: 0;
		font: inherit;
		font-weight: inherit;
		text-align: left;
		cursor: pointer;
	}
	.buka-toko:hover {
		color: #39754b;
	}
	.buka-toko:focus-visible, .tombol-kembali:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 3px;
	}
	.judul-toko p {
		margin: 5px 0 0;
		color: #718077;
		font-size: 12px;
	}
	.status {
		justify-self: end;
		padding: 6px 9px;
		border: 1px solid #d6e8d5;
		border-radius: 999px;
		background: #eaf4e9;
		color: #39754b;
		font-size: 10px;
		font-weight: 800;
		text-align: center;
	}
	.status.menunggu {
		border-color: #e6d4a9;
		background: #fff8e7;
		color: #946b26;
	}
	.status.ditolak, .status.dikenai {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	.menu-pilihan-deskripsi {
		min-width: 0;
		color: #718077;
	}
	.menu-pilihan-deskripsi summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		color: #39754b;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		list-style: none;
	}
	.menu-pilihan-deskripsi summary::-webkit-details-marker {
		display: none;
	}
	.menu-pilihan-deskripsi summary::after {
		content: '+';
		color: #718077;
		font-size: 16px;
		line-height: 1;
	}
	.menu-pilihan-deskripsi[open] summary::after {
		content: '−';
	}
	.menu-pilihan-deskripsi summary:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 3px;
	}
	.menu-pilihan-deskripsi p {
		margin: 8px 0 0;
		color: #718077;
		font-size: 12px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	.rincian {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 9px;
	}
	.rincian span {
		min-width: 0;
		padding: 9px 10px;
		background: #f7faf6;
		color: #718077;
		font-size: 10px;
	}
	.rincian strong {
		display: block;
		overflow: hidden;
		margin-top: 4px;
		color: #39754b;
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.teks-peringatan {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		color: #946b26;
		font-size: 11px;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}
	.catatan-sanksi {
		margin: 0 0 18px;
		border: 1px solid #edc9c6;
		border-radius: 7px;
		background: #fff0ef;
		padding: 11px 13px;
		color: #a44242;
	}
	.daftar-bukti {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	.daftar-bukti img {
		width: 64px;
		height: 64px;
		border: 1px solid #d6e1d5;
		border-radius: 6px;
		object-fit: cover;
	}
	.latar-dialog {
		position: fixed;
		z-index: 1000;
		inset: 0;
		display: grid;
		place-items: center;
		overflow-y: auto;
		background: #102419b8;
		padding: 20px;
	}
	.dialog-moderasi {
		position: relative;
		width: min(100%, 520px);
		max-height: calc(100vh - 40px);
		overflow-y: auto;
		margin: 0;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		padding: 24px;
		box-shadow: 0 24px 70px #0b1c1080;
	}
	.dialog-moderasi h2 {
		margin: 0;
		color: #183126;
		font-size: 22px;
		line-height: 1.3;
	}
	.bantuan-dialog {
		color: #718077;
		font-size: 13px;
		line-height: 1.5;
	}
	.dialog-moderasi form {
		display: grid;
		gap: 15px;
	}
	.dialog-moderasi label, .bidang-dialog {
		display: grid;
		gap: 7px;
		color: #385540;
		font-size: 12px;
		font-weight: 700;
	}
	.dialog-moderasi textarea, .dialog-moderasi input[type='number'] {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fbfdfb;
		padding: 11px;
		font: inherit;
	}
	.dialog-moderasi textarea {
		resize: vertical;
	}
	.dialog-moderasi small {
		color: #718077;
		font-size: 10px;
		font-weight: 400;
	}
	.pemilih-foto {
		display: flex !important;
		width: fit-content;
		align-items: center;
		gap: 10px !important;
		font-weight: 400 !important;
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
	.galat-dialog {
		margin: 0;
		border-radius: 6px;
		background: #fff0ef;
		padding: 10px;
		color: #a44242;
		font-size: 12px;
	}
	.aksi-dialog {
		display: flex;
		justify-content: flex-end;
		gap: 9px;
		border-top: 1px solid #e8eee6;
		padding-top: 14px;
	}
	.aksi-dialog button {
		min-height: 38px;
		border-radius: 7px;
		padding: 8px 12px;
		font: inherit;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.aksi-dialog button:disabled {
		opacity: .6;
		cursor: wait;
	}
	.aksi {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		border-top: 1px solid #e8eee6;
		padding-top: 12px;
		margin-top: auto;
	}
	.aksi button {
		flex: 1 1 auto;
		min-height: 36px;
		border: 1px solid transparent;
		border-radius: 7px;
		padding: 8px 10px;
		font: inherit;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.utama {
		border-color: #39754b !important;
		background: #39754b;
		color: #fff;
	}
	.pendukung {
		border-color: #39754b !important;
		background: #fff;
		color: #39754b;
	}
	.tombol-peringatan {
		border-color: #e6d4a9 !important;
		background: #fff8e7;
		color: #946b26;
	}
	.sanksi-kurangi {
		border-color: #d8c38e !important;
		background: #fffbf1;
		color: #795a1e;
	}
	.sanksi-naikkan {
		border-color: #a9c9aa !important;
		background: #edf8ed;
		color: #39754b;
	}
	.bahaya {
		border-color: #edc9c6 !important;
		background: #fff0ef;
		color: #a44242;
	}
	.keadaan {
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 28px;
		color: #718077;
		text-align: center;
	}
	.keadaan.galat {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	@media (max-width: 700px) {
		.kisi {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 900px) {
		.produk-dasbor {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 700px) {
		.kisi-ringkasan {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 560px) {
		.kerangka-halaman {
			padding: 28px 14px 54px;
		}
		.bilah {
			align-items: stretch;
			flex-direction: column;
			gap: 8px;
		}
		.bilah span {
			align-self: flex-end;
		}
		.judul-kartu {
			grid-template-columns: 38px minmax(0, 1fr);
		}
		.penanda-toko {
			width: 38px;
			height: 38px;
		}
		.status {
			grid-column: 2;
			justify-self: start;
		}
		.judul-dasbor {
			flex-direction: column;
		}
		.kisi-ringkasan {
			gap: 8px;
		}
		.kisi-ringkasan > div {
			padding: 12px;
		}
		.produk-dasbor {
			grid-template-columns: 1fr;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kartu-toko {
			transition: none;
		}
	}
</style>