<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { getMyShop } from '$lib/api/shop-api';
	import {
		cancelDirectContactOrder,
		confirmOrder,
		getSellerOrdersManage,
		type SellerManageOrder,
		type SellerManageResponse,
	} from '$lib/api/order-api';
	import { showConfirm } from '$lib/services/dialog';

	let currentUser = $state<CurrentUserDto | null>(null);
	let ordersData = $state<SellerManageResponse | null>(null);
	let activeFilter = $state<'all' | 'seller_waiting_payment' | 'seller_pending' | 'seller_unconfirmed' | 'seller_cancelled' | 'seller_completed'>('all');
	let isLoading = $state(true);
	let errorMessage = $state('');
	let confirmingId = $state<number | null>(null);
	let cancellingId = $state<number | null>(null);

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
		} catch {
			await goto('/signin');
			return;
		}
		const shopResponse = await getMyShop().catch(() => null);
		if (shopResponse?.shop?.banned_until && new Date(shopResponse.shop.banned_until).getTime() > Date.now()) {
			await goto('/toko', { replaceState: true });
			return;
		}
		await loadOrders(activeFilter);
	});

	async function loadOrders(filter: 'all' | 'seller_waiting_payment' | 'seller_pending' | 'seller_unconfirmed' | 'seller_cancelled' | 'seller_completed') {
		isLoading = true;
		errorMessage = '';
		try {
			ordersData = await getSellerOrdersManage(filter);
			activeFilter = filter;
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat pesanan toko.';
		} finally {
			isLoading = false;
		}
	}

	async function handleConfirm(orderId: number) {
		confirmingId = orderId;
		try {
			await confirmOrder(orderId);
			await loadOrders(activeFilter);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal mengonfirmasi pesanan.';
		} finally {
			confirmingId = null;
		}
	}

	async function handleCancelDirect(order: SellerManageOrder) {
		const confirmed = await showConfirm(
			`Transaksi Hubungi petani untuk order #${order.order_id} akan dibatalkan. Stok ready-stock dari pesanan ini akan dikembalikan.`,
			{ title: 'Batalkan transaksi?', tone: 'warning', confirmLabel: 'Batalkan transaksi', cancelLabel: 'Kembali' },
		);
		if (!confirmed) return;
		cancellingId = order.order_id;
		try {
			await cancelDirectContactOrder(order.order_id);
			await loadOrders(activeFilter);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal membatalkan transaksi.';
		} finally {
			cancellingId = null;
		}
	}

	function formatPrice(value: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function label(status: string) {
		return (
			{
				pending: 'Menunggu pembayaran pembeli',
				paid: 'Sudah dibayar',
				completed: 'Selesai',
				cancel: 'Dibatalkan',
				challenge: 'Menunggu verifikasi',
			} as Record<string, string>
		)[status] || status;
	}

	function statusClass(status: string) {
		switch (status) {
			case 'paid':
				return 'status-dibayar';
			case 'completed':
				return 'status-selesai';
			case 'cancel':
				return 'status-dibatalkan';
			case 'challenge':
				return 'status-sengketa';
			default:
				return 'status-menunggu';
		}
	}

	function formatWa(phone: string) {
		if (!phone) return '';
		const clean = phone.replace(/\D/g, '');
		return clean.startsWith('0') ? '62' + clean.slice(1) : clean;
	}
</script>

<svelte:head><title>Kelola Pesanan Toko | Tani Siaga</title></svelte:head>

<div class="bungkus-pesanan">
	<div class="utama-pesanan">
		<a class="tautan-kembali" href="/toko">← Kembali ke Dashboard Toko</a>

		<div class="judul-halaman">
			<p class="label-kecil">KELOLA PESANAN TOKO</p>
			<h1 class="judul">Pesanan Masuk</h1>
			<p class="subjudul">Pantau dan konfirmasi pesanan dari pembeli. Klik "Pesanan Selesai" setelah barang diserahkan / transaksi selesai.</p>
		</div>

		<div class="baris-ringkasan">
			<a class:terpilih={activeFilter === 'all'} class="kartu-ringkasan semua" href="#all" onclick={() => loadOrders('all')}>
				<span class="nomor">{ordersData?.counts?.all ?? 0}</span>
				<span class="label">Semua pesanan</span>
			</a>
			<a class:terpilih={activeFilter === 'seller_waiting_payment'} class="kartu-ringkasan pembayaran-menunggu" href="#waiting-payment" onclick={() => loadOrders('seller_waiting_payment')}>
				<span class="nomor">{ordersData?.counts?.seller_waiting_payment ?? 0}</span>
				<span class="label">Menunggu pembayaran pembeli</span>
			</a>
			<a class:terpilih={activeFilter === 'seller_pending'} class="kartu-ringkasan menunggu" href="#pending" onclick={() => loadOrders('seller_pending')}>
				<span class="nomor">{ordersData?.counts?.seller_pending ?? 0}</span>
				<span class="label">Perlu konfirmasi toko</span>
			</a>
			<a class:terpilih={activeFilter === 'seller_unconfirmed'} class="kartu-ringkasan menunggu" href="#unconfirmed" onclick={() => loadOrders('seller_unconfirmed')}>
				<span class="nomor">{ordersData?.counts?.seller_unconfirmed ?? 0}</span>
				<span class="label">Belum dikonfirmasi kedua pihak</span>
			</a>
			<a class:terpilih={activeFilter === 'seller_cancelled'} class="kartu-ringkasan dibatalkan" href="#cancelled" onclick={() => loadOrders('seller_cancelled')}>
				<span class="nomor">{ordersData?.counts?.seller_cancelled ?? 0}</span>
				<span class="label">Dibatalkan</span>
			</a>
			<a class:terpilih={activeFilter === 'seller_completed'} class="kartu-ringkasan selesai" href="#completed" onclick={() => loadOrders('seller_completed')}>
				<span class="nomor">{ordersData?.counts?.seller_completed ?? 0}</span>
				<span class="label">Selesai dua pihak</span>
			</a>
		</div>

		{#if errorMessage}
			<div class="peringatan galat">
				{errorMessage}
				<button onclick={() => loadOrders(activeFilter)}>Coba lagi</button>
			</div>
		{/if}

		{#if isLoading}
			<div class="keadaan">Memuat pesanan...</div>
		{:else if !ordersData || ordersData.data.length === 0}
			<div class="keadaan kosong">
				{activeFilter === 'seller_pending'
					? 'Tidak ada pesanan yang perlu dikonfirmasi toko saat ini.'
					: activeFilter === 'seller_waiting_payment'
					? 'Tidak ada pesanan yang menunggu pembayaran pembeli.'
					: activeFilter === 'seller_unconfirmed'
					? 'Tidak ada pesanan yang belum dikonfirmasi kedua pihak.'
					: activeFilter === 'seller_cancelled'
					? 'Belum ada pesanan yang dibatalkan.'
					: activeFilter === 'seller_completed'
					? 'Belum ada pesanan yang selesai dari kedua pihak.'
					: 'Belum ada pesanan masuk untuk toko Anda.'}
			</div>
		{:else}
			<div class="daftar-pesanan">
				{#each ordersData.data as order (order.order_id)}
					<article class="kartu-pesanan">
						<header class="kepala-pesanan">
							<div>
								<span class="id-pesanan">ORDER #{order.order_id} · {order.midtrans_order_id}</span>
								<h2>
									{order.total_items} item · {formatPrice(order.total_price)}
								</h2>
								<small>
									Dibuat:
									{order.created_at
										? new Intl.DateTimeFormat('id-ID', {
												dateStyle: 'long',
												timeStyle: 'short',
										  }).format(new Date(order.created_at))
										: '-'}
								</small>
							</div>
							<div class="kolom-status">
								<span class={statusClass(order.status)}>{order.is_preorder_deposit && order.status === 'paid' ? 'DP dibayar' : label(order.status)}</span>
								{#if order.status === 'pending'}
									<p class="catatan-pembayaran">Pesanan akan diproses setelah pembayaran diterima.</p>
								{:else if order.is_preorder_deposit}
									<p class="catatan-pembayaran">Menunggu panen dan pelunasan sebelum pesanan dapat diselesaikan.</p>
								{:else}
									<div class="informasi-konfirmasi">
										<span class="lencana" class:berhasil={order.buyer_confirmed}>
											Pembeli: {order.buyer_confirmed ? '✓ Sudah konfirmasi' : 'Belum konfirmasi'}
										</span>
										<span class="lencana aksen" class:berhasil={order.seller_confirmed}>
											Penjual: {order.seller_confirmed ? '✓ Sudah konfirmasi' : 'Belum konfirmasi'}
										</span>
									</div>
								{/if}
							</div>
						</header>

						<section class="isi-pesanan">
							<div class="penerima">
								<h3>Data Penerima</h3>
								<p><strong>{order.recipient_name}</strong></p>
								<p>
									📞 <a href={`tel:${order.recipient_phone}`}>{order.recipient_phone}</a>
										{#if order.recipient_phone && order.shipping_method === 'DIRECT_CONTACT' && !order.is_preorder_order}
										· <a class="wa" target="_blank" href={`https://wa.me/${formatWa(order.recipient_phone)}`}>WhatsApp ↗</a>
									{/if}
								</p>
								<p class="alamat">📍 {order.recipient_address}</p>
								<p class="kirim">
									{order.shipping_method === 'PICKUP' ? '📦 Pickup di lokasi toko' : '🤝 Hubungi petani langsung'}
								</p>
							</div>
							<div class="butir">
								<h3>Daftar Barang</h3>
								<ul>
									{#each order.items as item (item.product_id)}
										<li>
											<span class="nama-butir">
												{item.product_name}
																{#if item.is_pre_order}<em>(Pre-order)</em>{/if}
											</span>
											<span class="jumlah-butir">{item.quantity} × {formatPrice(item.price)}</span>
										</li>
									{/each}
								</ul>
							</div>
						</section>

						<footer class="bawah-pesanan">
							<a class="tautan-rincian" href={`/pesanan/${order.order_id}`}>Lihat detail pesanan →</a>
							<div class="aksi">
										{#if order.is_preorder_deposit}
											<span class="sudah">Menunggu panen dan pelunasan</span>
										{:else if order.shipping_method === 'DIRECT_CONTACT' && order.status === 'completed' && order.items.length > 0 && order.items.every((item) => !item.is_pre_order)}
											<button
												class="tombol-konfirmasi tombol-langsung-batal"
												disabled={cancellingId === order.order_id}
												onclick={() => handleCancelDirect(order)}
											>
												{cancellingId === order.order_id ? 'Membatalkan...' : 'Batalkan transaksi'}
											</button>
										{:else if order.status !== 'cancel' && order.status !== 'pending' && !order.seller_confirmed}
									<button
										class="tombol-konfirmasi"
										disabled={confirmingId === order.order_id}
										onclick={() => handleConfirm(order.order_id)}
									>
										{confirmingId === order.order_id ? 'Menyimpan...' : '✓ Tandai Pesanan Selesai'}
									</button>
								{:else if order.seller_confirmed}
									<span class="sudah">✓ Anda sudah konfirmasi pesanan ini</span>
								{/if}
							</div>
						</footer>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.bungkus-pesanan {
		flex: 1;
		color: #183126;
	}
	.utama-pesanan {
		max-width: 1060px;
		margin: auto;
		padding: 24px 28px 80px;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 24px;
		color: #39754b;
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
	}
	.judul-halaman {
		margin-bottom: 26px;
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
		font: 600 clamp(34px, 5vw, 54px)/1 'Fraunces', Georgia, serif;
	}
	.subjudul {
		max-width: 720px;
		margin: 14px 0 0;
		color: #718077;
		line-height: 1.6;
	}
	.baris-ringkasan {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		margin-bottom: 24px;
	}
	.kartu-ringkasan {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 6px;
		padding: 22px 18px;
		border-radius: 12px;
		background: #fff;
		border: 2px solid transparent;
		text-decoration: none;
		cursor: pointer;
		color: inherit;
		text-align: center;
	}
	.kartu-ringkasan .nomor {
		font: 700 38px 'Fraunces', Georgia, serif;
	}
	.kartu-ringkasan .label {
		color: #5b6e62;
		font-size: 12px;
		font-weight: 700;
	}
	.kartu-ringkasan.semua {
		border-color: #d6e1d5;
	}
	.kartu-ringkasan.semua .nomor {
		color: #183126;
	}
	.kartu-ringkasan.pembayaran-menunggu {
		background: #fff8e8;
		border-color: #f1dfb1;
	}
	.kartu-ringkasan.pembayaran-menunggu .nomor {
		color: #98702d;
	}
	.kartu-ringkasan.menunggu {
		background: #eef5fa;
		border-color: #c4d9e8;
	}
	.kartu-ringkasan.menunggu .nomor {
		color: #315f7b;
	}
	.kartu-ringkasan.dibatalkan {
		background: #fff0ef;
		border-color: #e6b8b3;
	}
	.kartu-ringkasan.dibatalkan .nomor {
		color: #a44242;
	}
	.kartu-ringkasan.selesai {
		background: #edf8ed;
		border-color: #b8dbb8;
	}
	.kartu-ringkasan.selesai .nomor {
		color: #2f6a41;
	}
	.kartu-ringkasan.terpilih {
		box-shadow: 0 0 0 3px #39754b inset;
	}
	.peringatan {
		padding: 14px 18px;
		border-radius: 8px;
		margin-bottom: 18px;
		font-size: 14px;
		font-weight: 600;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}
	.peringatan.galat {
		background: #fff0ef;
		color: #a44242;
		border: 1px solid #e6b8b3;
	}
	.peringatan button {
		background: #fff;
		color: #a44242;
		border: 1px solid #e6b8b3;
		padding: 8px 14px;
		border-radius: 6px;
		font-weight: 700;
		cursor: pointer;
	}
	.keadaan {
		padding: 60px 40px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		color: #718077;
		font-size: 15px;
	}
	.keadaan.kosong {
		background: #edf8ed;
		color: #39754b;
	}
	.daftar-pesanan {
		display: grid;
		gap: 16px;
	}
	.kartu-pesanan {
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e0a;
		overflow: hidden;
	}
	.kepala-pesanan {
		display: flex;
		justify-content: space-between;
		gap: 24px;
		padding: 20px 24px;
		border-bottom: 1px solid #eef4ed;
	}
	.id-pesanan {
		display: block;
		color: #718077;
		font-size: 11px;
		letter-spacing: 0.08em;
	}
	.kepala-pesanan h2 {
		margin: 6px 0 5px;
		font: 700 20px 'DM Sans', sans-serif;
	}
	.kepala-pesanan small {
		color: #829087;
		font-size: 11px;
	}
	.kolom-status {
		text-align: right;
		display: grid;
		gap: 10px;
		justify-items: end;
	}
	.kolom-status > span:first-child {
		display: inline-block;
		padding: 8px 12px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 800;
	}
	.status-menunggu {
		background: #fff8e8;
		color: #98702d;
	}
	.status-dibayar {
		background: #fff7de;
		color: #755b1f;
	}
	.status-selesai {
		background: #edf8ed;
		color: #39754b;
	}
	.status-dibatalkan {
		background: #fff0ef;
		color: #a44242;
	}
	.status-sengketa {
		background: #f0ecff;
		color: #5a4aa8;
	}
	.informasi-konfirmasi {
		display: grid;
		gap: 5px;
		justify-items: end;
	}
	.lencana {
		font-size: 11px;
		font-weight: 700;
		padding: 5px 9px;
		border-radius: 6px;
		background: #f0f4ef;
		color: #65786c;
	}
	.lencana.berhasil {
		background: #edf8ed;
		color: #2f6a41;
	}
	.lencana.aksen {
		background: #eef6ee;
		color: #385540;
	}
	.lencana.aksen.berhasil {
		background: #dcebd8;
		color: #1e4b2d;
	}
	.isi-pesanan {
		display: grid;
		grid-template-columns: 1fr 1.1fr;
		gap: 26px;
		padding: 22px 24px;
	}
	.isi-pesanan h3 {
		margin: 0 0 12px;
		color: #385540;
		font: 700 13px 'DM Sans', sans-serif;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.penerima p {
		margin: 4px 0;
		color: #183126;
		font-size: 14px;
	}
	.penerima a {
		color: #39754b;
		font-weight: 700;
		text-decoration: none;
	}
	.penerima a.wa {
		background: #25D366;
		color: #fff !important;
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 12px;
	}
	.alamat {
		color: #5b6e62 !important;
		line-height: 1.55;
	}
	.kirim {
		margin-top: 10px !important;
		padding-top: 10px;
		border-top: 1px dashed #d6e1d5;
		color: #39754b !important;
		font-weight: 700;
		font-size: 13px !important;
	}
	.butir ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
	}
	.butir li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		background: #f8fbf7;
		border-radius: 7px;
		font-size: 13px;
	}
	.nama-butir {
		color: #183126;
		font-weight: 600;
	}
	.jumlah-butir {
		color: #39754b;
		font-weight: 700;
	}
	.bawah-pesanan {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 14px;
		padding: 16px 24px;
		background: #f8fbf7;
		border-top: 1px solid #eef4ed;
	}
	.tautan-rincian {
		color: #39754b;
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
	}
	.tombol-konfirmasi {
		padding: 12px 20px;
		background: #39754b;
		color: #fff;
		border: none;
		border-radius: 8px;
		font: inherit;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		box-shadow: 0 6px 14px #39754b24;
	}
	.tombol-konfirmasi:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.tombol-langsung-batal {
		background: #a44242;
		box-shadow: 0 6px 14px #a4424224;
	}
	.sudah {
		color: #2f6a41;
		font-weight: 700;
		font-size: 13px;
		padding: 10px 14px;
		background: #dcebd8;
		border-radius: 7px;
	}
	@media (max-width: 900px) {
		.kepala-pesanan {
			flex-direction: column;
			align-items: flex-start;
		}
		.kolom-status {
			text-align: left;
			justify-items: start;
		}
		.isi-pesanan {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		.baris-ringkasan {
			grid-template-columns: 1fr;
		}
		.bawah-pesanan {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
