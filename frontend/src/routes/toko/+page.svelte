<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getMyShop, getMyShopProducts, updateMyShopProfileImage, type Shop, type MyProductsResponse } from '$lib/api/shop-api';
	import { uploadImage } from '$lib/api/media-api';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { getSellerOrdersManage, type SellerManageResponse } from '$lib/api/order-api';
	import Card from '$lib/components/Card.svelte';
	import AdminShopManagement from '$lib/components/AdminShopManagement.svelte';
	import ShopSanctionNotice from '$lib/components/ShopSanctionNotice.svelte';

	let currentUser = $state<CurrentUserDto | null>(null);
	let shop = $state<Shop | null>(null);
	let hasShop = $state<boolean | null>(null);
	let products = $state<MyProductsResponse['data']>([]);
	let approvedProducts = $derived(products.filter((product) => product.approval_status === 'approved'));
	let activeApprovedProducts = $derived(approvedProducts.filter((product) => product.is_active !== false));
	let pendingProducts = $derived(products.filter((product) => product.approval_status === 'pending'));
	let adminActionProducts = $derived(products.filter((product) => product.admin_action === 'disabled' || product.admin_action === 'deleted'));
	let availableProducts = $derived(
		activeApprovedProducts.filter((product) =>
			product.is_pre_order
				? product.po_quota_kg > product.po_booked_kg
				: product.stock > product.po_booked_kg
		)
	);
	let exhaustedProducts = $derived(
		activeApprovedProducts.filter((product) =>
			product.is_pre_order
				? product.po_quota_kg <= product.po_booked_kg
				: product.stock <= product.po_booked_kg
		)
	);
	let ordersManage = $state<SellerManageResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let isUploadingShopPhoto = $state(false);
	let shopPhotoError = $state('');
	let sanctionRefreshTimer: ReturnType<typeof setTimeout> | undefined;
	let isShopSanctioned = $derived(Boolean(shop?.banned_until && new Date(shop.banned_until).getTime() > Date.now()));

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
		} catch {
			currentUser = null;
			await goto('/signin');
			return;
		}
		if (currentUser.role === 'admin') {
			isLoading = false;
			return;
		}
		await loadDashboard();
	});

	async function loadDashboard() {
		isLoading = true;
		errorMessage = '';
		if (sanctionRefreshTimer) clearTimeout(sanctionRefreshTimer);
		try {
			const shopRes = await getMyShop();
			hasShop = shopRes.has_shop;
			shop = shopRes.shop;
			if (isShopSanctioned && shop?.banned_until) {
				products = [];
				ordersManage = null;
				sanctionRefreshTimer = setTimeout(() => void loadDashboard(), Math.max(1000, new Date(shop.banned_until!).getTime() - Date.now() + 1500));
				return;
			}
			const [productsRes, ordersRes] = await Promise.all([
				getMyShopProducts().catch(() => ({ message: '', data: [] })),
				getSellerOrdersManage('all').catch(() => null),
			]);
			products = productsRes.data || [];
			ordersManage = ordersRes;
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat dashboard toko.';
		} finally {
			isLoading = false;
		}
	}

	onDestroy(() => {
		if (sanctionRefreshTimer) clearTimeout(sanctionRefreshTimer);
	});

	function formatPrice(value: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function productImage(image_url: string[]) {
		return image_url?.[0] || '';
	}

	async function handleShopPhotoSelection(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			shopPhotoError = 'Foto toko harus berformat JPG, PNG, atau WebP.';
			input.value = '';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			shopPhotoError = 'Ukuran foto toko maksimal 5 MB.';
			input.value = '';
			return;
		}
		isUploadingShopPhoto = true;
		shopPhotoError = '';
		try {
			const image = await uploadImage(file, 'profile');
			shop = await updateMyShopProfileImage(image.url);
		} catch (error) {
			shopPhotoError = error instanceof Error ? error.message : 'Gagal memperbarui foto toko.';
		} finally {
			isUploadingShopPhoto = false;
			input.value = '';
		}
	}
</script>

<svelte:head><title>{currentUser?.role === 'admin' ? 'Kelola Toko' : 'Dashboard Toko'} | Tani Siaga</title></svelte:head>

<div class="bungkus-toko">
	{#if currentUser?.role === 'admin'}
		<AdminShopManagement />
	{:else}
	<div class="utama-toko">
		{#if isLoading}
			<div class="keadaan">Memuat dashboard toko...</div>
		{:else if errorMessage}
			<div class="keadaan galat">{errorMessage}<button onclick={loadDashboard}>Coba lagi</button></div>
		{:else if !hasShop}
			<section class="toko-tanpa">
				<div class="kartu-toko-tanpa">
					<div class="ikon-toko-tanpa">🌾</div>
					<p class="label-kecil">TOKO BELUM TERSEDIA</p>
					<h1 class="judul">Anda belum punya toko.</h1>
					<p class="subjudul">Buat toko untuk mulai menjual hasil panen langsung ke pembeli melalui Tani Siaga.</p>
					<div class="baris-ajakan">
						<a class="tombol-utama" href="/toko/create">Buat Toko Sekarang ↗</a>
						<a class="tombol-pendukung" href="/dashboard">Kembali ke Dashboard</a>
					</div>
					<ul class="manfaat">
						<li><strong>✓</strong> Kelola produk dan stok panen dengan mudah</li>
						<li><strong>✓</strong> Dapatkan pesanan dari pembeli langsung</li>
						<li><strong>✓</strong> Lacak status konfirmasi pesanan secara real-time</li>
					</ul>
				</div>
			</section>
		{:else if shop && isShopSanctioned}
			<ShopSanctionNotice reason={shop.ban_reason} evidenceUrls={shop.ban_evidence_urls} bannedUntil={shop.banned_until!} />
		{:else if shop && shop.approval_status !== 'approved'}
			<section class="keadaan-menunggu">
				<header class="utama-menunggu">
					<div class="teks-menunggu">
						<p class="label-kecil">PERMOHONAN TOKO</p>
						<h1 class="judul">Toko Anda sedang ditinjau.</h1>
						<p>Setelah disetujui, dashboard toko dan fitur penjualan akan terbuka.</p>
					</div>
					<div class="indikator-ulasan">
						<span class="titik-ulasan" aria-hidden="true"></span>
						<span><strong>Menunggu persetujuan</strong><small>Admin sedang meninjau pengajuan</small></span>
					</div>
				</header>

				<ol class="langkah-ulasan" aria-label="Tahapan persetujuan toko">
					<li class="selesai-langkah"><span class="nomor-langkah">01</span><span><strong>Pengajuan dikirim</strong><small>Data toko diterima</small></span></li>
					<li class="saat-ini-langkah" aria-current="step"><span class="nomor-langkah">02</span><span><strong>Review admin</strong><small>Sedang menunggu keputusan</small></span></li>
					<li class="akan-langkah"><span class="nomor-langkah">03</span><span><strong>Dashboard toko</strong><small>Terbuka setelah disetujui</small></span></li>
				</ol>

				<div class="rincian-menunggu">
					<section class="ringkasan-toko">
						<p class="label-kecil">DETAIL TOKO</p>
						<h2>{shop.name}</h2>
						<div class="fakta-toko">
							<div><span>Lokasi</span><strong>{shop.location || 'Belum diisi'}</strong></div>
							<div><span>Nomor kontak</span><strong>{shop.phone_number || 'Belum diisi'}</strong></div>
						</div>
						<p class="deskripsi-toko">{shop.description || 'Tidak ada deskripsi toko.'}</p>
					</section>

					<section class="produk-menunggu">
						<div class="judul-produk-menunggu">
							<div><p class="label-kecil">PRODUK</p><h2>Menunggu review</h2></div>
							<span class="jumlah-produk">{pendingProducts.length}</span>
						</div>
						{#if pendingProducts.length > 0}
							<ul class="daftar-menunggu">
								{#each pendingProducts as product (product.id)}
									<li><span>{product.name}</span><strong>Pending</strong></li>
								{/each}
							</ul>
						{:else}
							<p class="sebaris-kosong">Belum ada produk yang dikirim untuk review.</p>
						{/if}
					</section>
				</div>
			</section>
		{:else}
			<section class="utama">
				<div class="teks-utama">
					<div class="kontrol-foto-toko">
						{#if shop?.profile_image_url}
							<img src={shop.profile_image_url} alt={`Foto ${shop.name}`} />
						{:else}
							<span aria-hidden="true">{shop?.name?.slice(0, 1).toUpperCase() || 'T'}</span>
						{/if}
						<label class="tombol-foto-toko">{isUploadingShopPhoto ? 'Mengunggah...' : 'Pilih foto toko'}
							<input type="file" accept="image/jpeg,image/png,image/webp" onchange={handleShopPhotoSelection} disabled={isUploadingShopPhoto} />
						</label>
						{#if shopPhotoError}<small>{shopPhotoError}</small>{/if}
					</div>
					<p class="label-kecil">DASHBOARD TOKO</p>
					<h1 class="judul">{shop?.name || 'Toko Saya'}</h1>
					<p class="lokasi-utama">📍 {shop?.location || 'Lokasi belum diatur'}</p>
					<div class="informasi-utama">
						<span class="telepon-toko">📞 {shop?.phone_number}</span>
					</div>
					<p class="deskripsi-utama">{shop?.description}</p>
					<div class="aksi-utama">
						<a class="tombol-utama" href="/toko/pesanan">Kelola Pesanan {ordersManage?.counts?.seller_pending ? `(${ordersManage.counts.seller_pending} belum dikonfirmasi)` : ''}</a>
						<a class="tombol-pendukung" href="/e-commerce">Lihat Katalog</a>
					</div>
				</div>
				<div class="statistik-utama">
					<div class="kartu-statistik aksen">
						<span class="nomor-statistik">{activeApprovedProducts.length}</span>
						<span class="label-statistik">Produk terdaftar</span>
					</div>
					<div class="kartu-statistik menunggu">
						<span class="nomor-statistik">{ordersManage?.counts?.seller_pending ?? 0}</span>
						<span class="label-statistik">Pesanan butuh konfirmasi</span>
					</div>
					<div class="kartu-statistik selesai">
						<span class="nomor-statistik">{ordersManage?.counts?.seller_unconfirmed ?? 0}</span>
						<span class="label-statistik">Belum dikonfirmasi kedua pihak</span>
					</div>
				</div>
			</section>

			{#if shop?.warning_reason}
				<section class="peringatan-toko" aria-label="Peringatan toko">
					<span class="penanda-peringatan" aria-hidden="true">!</span>
					<div><p class="label-kecil">PERINGATAN ADMIN</p><p>{shop.warning_reason}</p>{#if shop.warning_at}<small>{new Date(shop.warning_at).toLocaleDateString('id-ID')}</small>{/if}
						{#if shop.warning_evidence_urls?.length}<div class="bukti-peringatan">{#each shop.warning_evidence_urls as image}<a href={image} target="_blank" rel="noopener noreferrer"><img src={image} alt="Bukti peringatan dari admin" /></a>{/each}</div>{/if}
					</div>
				</section>
			{/if}

			{#if adminActionProducts.length > 0}
				<section class="daftar-peringatan-produk-admin" aria-label="Pemberitahuan tindakan admin pada produk">
					<header><p class="label-kecil">PEMBERITAHUAN PRODUK</p><h2>Perlu perhatian</h2></header>
					{#each adminActionProducts as product (product.id)}
						<article class="peringatan-produk-admin" class:dihapus={product.admin_action === 'deleted'}>
							<span class="ikon-peringatan" aria-hidden="true">!</span>
							<p><strong>{product.name}</strong> {product.admin_action === 'deleted' ? 'dihapus' : 'dinonaktifkan'} oleh admin. Alasan: {product.admin_action_reason || 'Tidak ada alasan yang dicantumkan.'}</p>
						</article>
					{/each}
				</section>
			{/if}

			<section class="bagian-produk">
				<div class="judul-bagian">
					<div>
						<p class="label-kecil">DAFTAR PRODUK TOKO</p>
						<h2>Kelola produk dan stokmu</h2>
					</div>
					<div class="aksi-bagian">
						<a class="semua-tautan" href="/toko/pesanan">Lihat semua pesanan →</a>
						<a class="tombol-utama tombol-buat" href="/toko/produk/create">+ Buat Produk</a>
					</div>
				</div>

				{#if pendingProducts.length > 0}
					<div class="produk-menunggu">
						<div class="judul-produk-menunggu">
							<div>
								<p class="label-kecil">MENUNGGU PERSETUJUAN ADMIN</p>
								<h3>Produk sedang ditinjau</h3>
							</div>
							<span class="jumlah-menunggu">{pendingProducts.length} produk</span>
						</div>
						<ul>
							{#each pendingProducts as product (product.id)}
								<li><span>{product.name}</span><strong>Pending</strong></li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if activeApprovedProducts.length === 0}
					<div class="produk-kosong">
						<p>{pendingProducts.length > 0 ? 'Produk yang disetujui admin akan muncul di daftar ini.' : adminActionProducts.length > 0 ? 'Produk aktif akan muncul di daftar ini.' : 'Belum ada produk disetujui di toko ini.'}</p>
						{#if pendingProducts.length === 0}<a class="tombol-utama" href="/toko/produk/create">+ Buat Produk Pertama</a>{/if}
					</div>
				{:else if availableProducts.length === 0}
					<div class="produk-kosong">
						<p>Semua produk sedang habis.</p>
					</div>
				{:else}
					<div class="kisi-produk">
						{#each availableProducts as product (product.id)}
							<Card
								product={product}
								actionHref={`/toko/produk/${product.id}`}
								actionLabel="Edit / Hapus Produk →"
							/>
						{/each}
					</div>
				{/if}
			</section>

			{#if exhaustedProducts.length > 0}
				<section class="bagian-produk bagian-habis">
					<div class="judul-bagian">
						<div>
							<p class="label-kecil">STOK 0 / KUOTA PENUH</p>
							<h2>Produk Habis</h2>
						</div>
						<span class="jumlah-habis">{exhaustedProducts.length} produk</span>
					</div>
					<div class="kisi-produk">
						{#each exhaustedProducts as product (product.id)}
							<Card
								product={product}
								actionHref={`/toko/produk/${product.id}`}
								actionLabel="Edit / Hapus Produk →"
							/>
						{/each}
					</div>
				</section>
			{/if}
		{/if}
	</div>
	{/if}
</div>

<style>
	.bungkus-toko {
		flex: 1;
		color: #183126;
	}
	.utama-toko {
		max-width: 1180px;
		margin: auto;
		padding: 30px 28px 70px;
	}
	.daftar-peringatan-produk-admin {
		display: grid;
		gap: 9px;
		margin: 0 0 30px;
	}
	.daftar-peringatan-produk-admin > header {
		margin-bottom: 2px;
	}
	.daftar-peringatan-produk-admin .label-kecil {
		margin-bottom: 5px;
	}
	.daftar-peringatan-produk-admin h2 {
		margin: 0;
		font-size: 19px;
	}
	.peringatan-produk-admin {
		display: flex;
		align-items: flex-start;
		gap: 11px;
		border: 1px solid #e6d4a9;
		border-radius: 8px;
		background: #fff8e8;
		padding: 12px 14px;
	}
	.peringatan-produk-admin.dihapus {
		border-color: #edc9c6;
		background: #fff0ef;
	}
	.ikon-peringatan {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: #fff0cc;
		color: #946b26;
		font-size: 12px;
		font-weight: 800;
	}
	.peringatan-produk-admin.dihapus .ikon-peringatan {
		background: #ffe1de;
		color: #a44242;
	}
	.peringatan-produk-admin p {
		margin: 1px 0 0;
		color: #655435;
		font-size: 12px;
		line-height: 1.5;
	}
	.peringatan-produk-admin.dihapus p {
		color: #8f403b;
	}
	.peringatan-produk-admin strong {
		color: #493d28;
	}
	.peringatan-produk-admin.dihapus strong {
		color: #763732;
	}
	.peringatan-toko {
		display: flex;
		align-items: flex-start;
		gap: 13px;
		margin: 0 0 25px;
		border: 1px solid #e6d4a9;
		border-radius: 8px;
		background: #fff8e8;
		padding: 15px 17px;
	}
	.penanda-peringatan {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: #fff0cc;
		color: #946b26;
		font-size: 14px;
		font-weight: 800;
	}
	.peringatan-toko .label-kecil {
		margin: 0 0 5px;
		color: #946b26;
	}
	.peringatan-toko p:not(.label-kecil) {
		margin: 0;
		color: #5d5140;
		font-size: 13px;
		line-height: 1.5;
	}
	.peringatan-toko small {
		display: block;
		margin-top: 5px;
		color: #8b7957;
		font-size: 11px;
	}
	.bukti-peringatan {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}
	.bukti-peringatan img {
		width: 82px;
		height: 82px;
		border: 1px solid #e6d4a9;
		border-radius: 7px;
		object-fit: cover;
	}
	.keadaan-menunggu {
		max-width: 1100px;
		margin: 0 auto;
		padding: 46px 28px 68px;
	}
	.utama-menunggu {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 28px;
		padding-bottom: 30px;
		border-bottom: 1px solid #d6e1d5;
	}
	.teks-menunggu {
		max-width: 650px;
	}
	.teks-menunggu .label-kecil {
		margin-bottom: 10px;
	}
	.teks-menunggu h1 {
		margin: 0;
		font: 600 42px/1.12 'Fraunces', Georgia, serif;
	}
	.teks-menunggu > p:last-child {
		margin: 12px 0 0;
		color: #718077;
		line-height: 1.6;
	}
	.indikator-ulasan {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 11px;
		border: 1px solid #ead9aa;
		border-radius: 8px;
		background: #fffaf0;
		padding: 13px 16px;
	}
	.indikator-ulasan > span:last-child {
		display: grid;
		gap: 4px;
	}
	.indikator-ulasan strong {
		color: #795a1e;
		font-size: 12px;
	}
	.indikator-ulasan small {
		color: #8b7957;
		font-size: 10px;
	}
	.titik-ulasan {
		width: 10px;
		height: 10px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: #d49a34;
		box-shadow: 0 0 0 4px #f5e8c8;
	}
	.langkah-ulasan {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		margin: 0;
		padding: 22px 0;
		border-bottom: 1px solid #d6e1d5;
		list-style: none;
	}
	.langkah-ulasan li {
		display: flex;
		align-items: center;
		gap: 11px;
		min-width: 0;
	}
	.nomor-langkah {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		flex: 0 0 auto;
		border: 1px solid #d6e1d5;
		border-radius: 50%;
		color: #718077;
		font-size: 11px;
		font-weight: 800;
	}
	.langkah-ulasan li > span:last-child {
		display: grid;
		min-width: 0;
		gap: 4px;
	}
	.langkah-ulasan strong {
		color: #536d5a;
		font-size: 14px;
	}
	.langkah-ulasan small {
		overflow: hidden;
		color: #718077;
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.langkah-ulasan .selesai-langkah .nomor-langkah {
		border-color: #a9c9aa;
		background: #eaf4e9;
		color: #39754b;
	}
	.langkah-ulasan .saat-ini-langkah .nomor-langkah {
		border-color: #e6d4a9;
		background: #fff3d6;
		color: #946b26;
	}
	.langkah-ulasan .saat-ini-langkah strong {
		color: #795a1e;
	}
	.rincian-menunggu {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr);
		gap: 30px;
		padding-top: 27px;
	}
	.ringkasan-toko {
		padding-right: 30px;
		border-right: 1px solid #e4ebe2;
	}
	.ringkasan-toko .label-kecil, .judul-produk-menunggu .label-kecil {
		margin-bottom: 7px;
	}
	.ringkasan-toko h2, .judul-produk-menunggu h2 {
		margin: 0;
		color: #183126;
		font-size: 20px;
	}
	.fakta-toko {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-top: 20px;
	}
	.fakta-toko div {
		display: grid;
		gap: 5px;
		min-width: 0;
	}
	.fakta-toko span {
		color: #718077;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}
	.fakta-toko strong {
		overflow-wrap: anywhere;
		color: #385540;
		font-size: 13px;
		font-weight: 600;
	}
	.deskripsi-toko {
		max-width: 600px;
		margin: 18px 0 0;
		color: #718077;
		font-size: 13px;
		line-height: 1.6;
	}
	.judul-produk-menunggu {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 14px;
		margin-bottom: 14px;
	}
	.jumlah-produk {
		display: grid;
		place-items: center;
		min-width: 30px;
		height: 30px;
		border-radius: 50%;
		background: #fff3d6;
		color: #795a1e;
		font-size: 11px;
		font-weight: 800;
	}
	.daftar-menunggu {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.daftar-menunggu li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 14px;
		padding: 12px 0;
		border-top: 1px solid #e8eee6;
		color: #385540;
		font-size: 12px;
	}
	.daftar-menunggu li strong {
		flex: 0 0 auto;
		border-radius: 999px;
		background: #fff3d6;
		color: #845b13;
		padding: 6px 9px;
		font-size: 10px;
	}
	.sebaris-kosong {
		margin: 0;
		border-top: 1px solid #e8eee6;
		padding: 13px 0;
		color: #718077;
		font-size: 12px;
		line-height: 1.5;
	}
	.keadaan {
		padding: 60px 40px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		color: #718077;
	}
	.keadaan.galat {
		color: #a44242;
		background: #fff0ef;
	}
	.keadaan button {
		display: block;
		margin: 18px auto 0;
		border: 1px solid #39754b;
		background: #fff;
		color: #39754b;
		padding: 10px 18px;
		border-radius: 7px;
		font-weight: 700;
		cursor: pointer;
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
	.label-kecil {
		margin: 0 0 10px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.kartu-toko-tanpa h1 {
		margin: 0;
		font: 600 clamp(32px, 5vw, 52px)/1 'Fraunces', Georgia, serif;
	}
	.subjudul {
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
		margin-bottom: 32px;
	}
	.tombol-utama {
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
	.tombol-pendukung {
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
	.manfaat {
		list-style: none;
		padding: 24px 0 0;
		margin: 0;
		text-align: left;
		border-top: 1px dashed #d6e1d5;
		display: grid;
		gap: 10px;
		color: #385540;
		font-size: 14px;
	}
	.manfaat strong {
		color: #39754b;
		margin-right: 8px;
	}
	.utama {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 40px;
		align-items: stretch;
		margin-bottom: 52px;
	}
	.teks-utama {
		padding: 34px 36px;
		border: 1px solid #31543e;
		border-radius: 14px;
		background: #183126;
		box-shadow: 0 8px 24px #23472e0c;
	}
	.kontrol-foto-toko {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 17px;
	}
	.kontrol-foto-toko > img, .kontrol-foto-toko > span {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border: 1px solid #6c9b72;
		border-radius: 50%;
		background: #dcebd8;
		color: #39754b;
		font-size: 24px;
		font-weight: 800;
		object-fit: cover;
	}
	.kontrol-foto-toko label {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 34px;
		border: 1px solid #6c9b72;
		border-radius: 7px;
		background: #2d603c;
		color: #fff;
		padding: 0 12px;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		transition: background .15s, border-color .15s;
	}
	.kontrol-foto-toko label:hover {
		border-color: #8ec18d;
		background: #39754b;
	}
	.kontrol-foto-toko input {
		position: absolute;
		inset: 0;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.kontrol-foto-toko small {
		color: #f2b7b0;
		font-size: 10px;
	}
	.teks-utama h1 {
		margin: 0;
		color: #fff;
		font: 600 clamp(36px, 5vw, 58px)/1 'Fraunces', Georgia, serif;
	}
	.lokasi-utama {
		margin: 14px 0 8px;
		color: #f4d69d;
		font-size: 15px;
		font-weight: 700;
	}
	.informasi-utama {
		color: #a8c7aa;
		font-size: 13px;
	}
	.deskripsi-utama {
		margin: 22px 0 28px;
		color: #d6e1d5;
		line-height: 1.65;
	}
	.teks-utama .label-kecil {
		color: #8ec18d;
	}
	.teks-utama .tombol-utama {
		background: #4f9361;
		box-shadow: none;
	}
	.teks-utama .tombol-pendukung {
		border-color: #6c9b72;
		background: transparent;
		color: #fff;
	}
	.aksi-utama {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.statistik-utama {
		display: grid;
		grid-template-rows: repeat(3, 1fr);
		gap: 14px;
	}
	.kartu-statistik {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 6px;
		padding: 24px 20px;
		border-radius: 12px;
		background: #fff;
		border: 1px solid #d6e1d5;
	}
	.nomor-statistik {
		font: 700 42px 'Fraunces', Georgia, serif;
		color: #183126;
	}
	.label-statistik {
		color: #718077;
		font-size: 12px;
		font-weight: 700;
		text-align: center;
	}
	.kartu-statistik.aksen {
		background: #dcebd8;
		border-color: #b5d4b1;
	}
	.kartu-statistik.aksen .nomor-statistik {
		color: #39754b;
	}
	.kartu-statistik.menunggu {
		background: #fff8e8;
		border-color: #f1dfb1;
	}
	.kartu-statistik.menunggu .nomor-statistik {
		color: #98702d;
	}
	.kartu-statistik.selesai {
		background: #edf8ed;
		border-color: #b8dbb8;
	}
	.kartu-statistik.selesai .nomor-statistik {
		color: #2f6a41;
	}
	.judul-bagian {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 22px;
	}
	.judul-bagian h2 {
		margin: 0;
		font: 600 clamp(26px, 3.5vw, 38px)/1 'Fraunces', Georgia, serif;
	}
	.aksi-bagian {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.tombol-buat {
		padding: 11px 18px;
		box-shadow: 0 6px 14px #39754b22;
	}
	.semua-tautan {
		color: #39754b;
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
	}
	.produk-kosong {
		padding: 54px 34px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		color: #718077;
	}
	.produk-kosong p {
		margin: 0 0 24px;
	}
	.produk-menunggu {
		margin-bottom: 20px;
		padding: 20px 22px;
		border: 1px solid #ead9aa;
		border-radius: 12px;
		background: #fffaf0;
	}
	.judul-produk-menunggu {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 14px;
	}
	.judul-produk-menunggu .label-kecil {
		margin-bottom: 5px;
	}
	.judul-produk-menunggu h3 {
		margin: 0;
		font-size: 18px;
	}
	.jumlah-menunggu {
		flex: 0 0 auto;
		color: #795a1e;
		font-size: 13px;
		font-weight: 700;
	}
	.produk-menunggu ul {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.produk-menunggu li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 11px 13px;
		border: 1px solid #f0e5c8;
		border-radius: 8px;
		background: #fff;
	}
	.produk-menunggu li strong {
		flex: 0 0 auto;
		min-width: 70px;
		padding: 7px 10px;
		border-radius: 999px;
		background: #fff1cf;
		color: #845b13;
		font-size: 12px;
		text-align: center;
	}
	.kisi-produk {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 18px;
	}
	.bagian-habis {
		margin-top: 44px;
		padding-top: 32px;
		border-top: 1px solid #d6e1d5;
	}
	.jumlah-habis {
		color: #718077;
		font-size: 13px;
		font-weight: 700;
	}
	@media (max-width: 960px) {
		.utama {
			grid-template-columns: 1fr;
		}
		.kisi-produk {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 760px) {
		.keadaan-menunggu {
			padding: 34px 22px 54px;
		}
		.utama-menunggu {
			align-items: flex-start;
			flex-direction: column;
			gap: 20px;
		}
		.teks-menunggu h1 {
			font-size: 34px;
		}
		.langkah-ulasan {
			grid-template-columns: 1fr;
			gap: 0;
		}
		.langkah-ulasan li {
			padding: 10px 0;
		}
		.rincian-menunggu {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.ringkasan-toko {
			padding: 0 0 22px;
			border-right: 0;
			border-bottom: 1px solid #e4ebe2;
		}
	}
	@media (max-width: 480px) {
		.keadaan-menunggu {
			padding: 28px 16px 44px;
		}
		.teks-menunggu h1 {
			font-size: 30px;
		}
		.fakta-toko {
			grid-template-columns: 1fr;
			gap: 14px;
		}
	}
	@media (max-width: 600px) {
		.kisi-produk {
			grid-template-columns: 1fr;
		}
	}
</style>
