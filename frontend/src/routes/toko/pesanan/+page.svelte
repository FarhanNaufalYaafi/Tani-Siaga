<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import {
		confirmOrder,
		getSellerOrdersManage,
		type SellerManageOrder,
		type SellerManageResponse,
	} from '$lib/api/order-api';

	let currentUser = $state<CurrentUserDto | null>(null);
	let ordersData = $state<SellerManageResponse | null>(null);
	let activeFilter = $state<'all' | 'seller_waiting_payment' | 'seller_pending' | 'seller_unconfirmed' | 'seller_cancelled' | 'seller_completed'>('all');
	let isLoading = $state(true);
	let errorMessage = $state('');
	let confirmingId = $state<number | null>(null);

	onMount(async () => {
		try {
			currentUser = await getCurrentUser();
		} catch {
			await goto('/signin');
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
				return 'status-paid';
			case 'completed':
				return 'status-completed';
			case 'cancel':
				return 'status-cancel';
			case 'challenge':
				return 'status-challenge';
			default:
				return 'status-pending';
		}
	}

	function formatWa(phone: string) {
		if (!phone) return '';
		const clean = phone.replace(/\D/g, '');
		return clean.startsWith('0') ? '62' + clean.slice(1) : clean;
	}
</script>

<svelte:head><title>Kelola Pesanan Toko | Tani Siaga</title></svelte:head>

<div class="orders-wrap">
	<div class="orders-main">
		<a class="back-link" href="/toko">← Kembali ke Dashboard Toko</a>

		<div class="page-heading">
			<p class="eyebrow">KELOLA PESANAN TOKO</p>
			<h1>Pesanan Masuk</h1>
			<p class="subtitle">Pantau dan konfirmasi pesanan dari pembeli. Klik "Pesanan Selesai" setelah barang diserahkan / transaksi selesai.</p>
		</div>

		<div class="summary-row">
			<a class:selected={activeFilter === 'all'} class="summary-card all" href="#all" onclick={() => loadOrders('all')}>
				<span class="num">{ordersData?.counts?.all ?? 0}</span>
				<span class="lbl">Semua pesanan</span>
			</a>
			<a class:selected={activeFilter === 'seller_waiting_payment'} class="summary-card waiting-payment" href="#waiting-payment" onclick={() => loadOrders('seller_waiting_payment')}>
				<span class="num">{ordersData?.counts?.seller_waiting_payment ?? 0}</span>
				<span class="lbl">Menunggu pembayaran pembeli</span>
			</a>
			<a class:selected={activeFilter === 'seller_pending'} class="summary-card pending" href="#pending" onclick={() => loadOrders('seller_pending')}>
				<span class="num">{ordersData?.counts?.seller_pending ?? 0}</span>
				<span class="lbl">Perlu konfirmasi toko</span>
			</a>
			<a class:selected={activeFilter === 'seller_unconfirmed'} class="summary-card pending" href="#unconfirmed" onclick={() => loadOrders('seller_unconfirmed')}>
				<span class="num">{ordersData?.counts?.seller_unconfirmed ?? 0}</span>
				<span class="lbl">Belum dikonfirmasi kedua pihak</span>
			</a>
			<a class:selected={activeFilter === 'seller_cancelled'} class="summary-card cancelled" href="#cancelled" onclick={() => loadOrders('seller_cancelled')}>
				<span class="num">{ordersData?.counts?.seller_cancelled ?? 0}</span>
				<span class="lbl">Dibatalkan</span>
			</a>
			<a class:selected={activeFilter === 'seller_completed'} class="summary-card done" href="#completed" onclick={() => loadOrders('seller_completed')}>
				<span class="num">{ordersData?.counts?.seller_completed ?? 0}</span>
				<span class="lbl">Selesai dua pihak</span>
			</a>
		</div>

		{#if errorMessage}
			<div class="alert error">
				{errorMessage}
				<button onclick={() => loadOrders(activeFilter)}>Coba lagi</button>
			</div>
		{/if}

		{#if isLoading}
			<div class="state">Memuat pesanan...</div>
		{:else if !ordersData || ordersData.data.length === 0}
			<div class="state empty">
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
			<div class="orders-list">
				{#each ordersData.data as order (order.order_id)}
					<article class="order-card">
						<header class="order-head">
							<div>
								<span class="order-id">ORDER #{order.order_id} · {order.midtrans_order_id}</span>
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
							<div class="status-col">
								<span class={statusClass(order.status)}>{label(order.status)}</span>
								{#if order.status === 'pending'}
									<p class="payment-note">Pesanan akan diproses setelah pembayaran diterima.</p>
								{:else}
									<div class="confirm-meta">
										<span class="badge" class:ok={order.buyer_confirmed}>
											Pembeli: {order.buyer_confirmed ? '✓ Sudah konfirmasi' : 'Belum konfirmasi'}
										</span>
										<span class="badge accent" class:ok={order.seller_confirmed}>
											Penjual: {order.seller_confirmed ? '✓ Sudah konfirmasi' : 'Belum konfirmasi'}
										</span>
									</div>
								{/if}
							</div>
						</header>

						<section class="order-body">
							<div class="receiver">
								<h3>Data Penerima</h3>
								<p><strong>{order.recipient_name}</strong></p>
								<p>
									📞 <a href={`tel:${order.recipient_phone}`}>{order.recipient_phone}</a>
									{#if order.recipient_phone}
										· <a class="wa" target="_blank" href={`https://wa.me/${formatWa(order.recipient_phone)}`}>WhatsApp ↗</a>
									{/if}
								</p>
								<p class="address">📍 {order.recipient_address}</p>
								<p class="ship">
									{order.shipping_method === 'PICKUP' ? '📦 Pickup di lokasi toko' : '🤝 Hubungi petani langsung'}
								</p>
							</div>
							<div class="items">
								<h3>Daftar Barang</h3>
								<ul>
									{#each order.items as item (item.product_id)}
										<li>
											<span class="item-name">
												{item.product_name}
																{#if item.is_pre_order}<em>(Pre-order)</em>{/if}
											</span>
											<span class="item-qty">{item.quantity} × {formatPrice(item.price)}</span>
										</li>
									{/each}
								</ul>
							</div>
						</section>

						<footer class="order-foot">
							<a class="detail-link" href={`/pesanan/${order.order_id}`}>Lihat detail pesanan →</a>
							<div class="actions">
								{#if order.status !== 'cancel' && order.status !== 'pending' && !order.seller_confirmed}
									<button
										class="confirm-btn"
										disabled={confirmingId === order.order_id}
										onclick={() => handleConfirm(order.order_id)}
									>
										{confirmingId === order.order_id ? 'Menyimpan...' : '✓ Tandai Pesanan Selesai'}
									</button>
								{:else if order.seller_confirmed}
									<span class="already">✓ Anda sudah konfirmasi pesanan ini</span>
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
	.orders-wrap { flex: 1; color: #183126; }

	.orders-main {
		max-width: 1060px;
		margin: auto;
		padding: 24px 28px 80px;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 24px;
		color: #39754b;
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
	}

	.page-heading { margin-bottom: 26px; }
	.eyebrow {
		margin: 0 0 10px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.page-heading h1 {
		margin: 0;
		font: 600 clamp(34px, 5vw, 54px)/1 'Fraunces', Georgia, serif;
	}
	.subtitle {
		max-width: 720px;
		margin: 14px 0 0;
		color: #718077;
		line-height: 1.6;
	}

	.summary-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		margin-bottom: 24px;
	}
	.summary-card {
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
	.summary-card .num {
		font: 700 38px 'Fraunces', Georgia, serif;
	}
	.summary-card .lbl {
		color: #5b6e62;
		font-size: 12px;
		font-weight: 700;
	}
	.summary-card.all { border-color: #d6e1d5; }
	.summary-card.all .num { color: #183126; }
	.summary-card.waiting-payment { background: #fff8e8; border-color: #f1dfb1; }
	.summary-card.waiting-payment .num { color: #98702d; }
	.summary-card.pending { background: #eef5fa; border-color: #c4d9e8; }
	.summary-card.pending .num { color: #315f7b; }
	.summary-card.cancelled { background: #fff0ef; border-color: #e6b8b3; }
	.summary-card.cancelled .num { color: #a44242; }
	.summary-card.done { background: #edf8ed; border-color: #b8dbb8; }
	.summary-card.done .num { color: #2f6a41; }
	.summary-card.selected {
		box-shadow: 0 0 0 3px #39754b inset;
	}

	.alert {
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
	.alert.error { background: #fff0ef; color: #a44242; border: 1px solid #e6b8b3; }
	.alert button {
		background: #fff;
		color: #a44242;
		border: 1px solid #e6b8b3;
		padding: 8px 14px;
		border-radius: 6px;
		font-weight: 700;
		cursor: pointer;
	}

	.state {
		padding: 60px 40px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		color: #718077;
		font-size: 15px;
	}
	.state.empty { background: #edf8ed; color: #39754b; }

	.orders-list { display: grid; gap: 16px; }
	.order-card {
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e0a;
		overflow: hidden;
	}
	.order-head {
		display: flex;
		justify-content: space-between;
		gap: 24px;
		padding: 20px 24px;
		border-bottom: 1px solid #eef4ed;
	}
	.order-id {
		display: block;
		color: #718077;
		font-size: 11px;
		letter-spacing: 0.08em;
	}
	.order-head h2 {
		margin: 6px 0 5px;
		font: 700 20px 'DM Sans', sans-serif;
	}
	.order-head small { color: #829087; font-size: 11px; }
	.status-col {
		text-align: right;
		display: grid;
		gap: 10px;
		justify-items: end;
	}
	.status-col > span:first-child {
		display: inline-block;
		padding: 8px 12px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 800;
	}
	.status-pending { background: #fff8e8; color: #98702d; }
	.status-paid { background: #fff7de; color: #755b1f; }
	.status-completed { background: #edf8ed; color: #39754b; }
	.status-cancel { background: #fff0ef; color: #a44242; }
	.status-challenge { background: #f0ecff; color: #5a4aa8; }
	.confirm-meta {
		display: grid;
		gap: 5px;
		justify-items: end;
	}
	.badge {
		font-size: 11px;
		font-weight: 700;
		padding: 5px 9px;
		border-radius: 6px;
		background: #f0f4ef;
		color: #65786c;
	}
	.badge.ok { background: #edf8ed; color: #2f6a41; }
	.badge.accent { background: #eef6ee; color: #385540; }
	.badge.accent.ok { background: #dcebd8; color: #1e4b2d; }

	.order-body {
		display: grid;
		grid-template-columns: 1fr 1.1fr;
		gap: 26px;
		padding: 22px 24px;
	}
	.order-body h3 {
		margin: 0 0 12px;
		color: #385540;
		font: 700 13px 'DM Sans', sans-serif;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.receiver p {
		margin: 4px 0;
		color: #183126;
		font-size: 14px;
	}
	.receiver a { color: #39754b; font-weight: 700; text-decoration: none; }
	.receiver a.wa {
		background: #25D366;
		color: #fff !important;
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 12px;
	}
	.address {
		color: #5b6e62 !important;
		line-height: 1.55;
	}
	.ship {
		margin-top: 10px !important;
		padding-top: 10px;
		border-top: 1px dashed #d6e1d5;
		color: #39754b !important;
		font-weight: 700;
		font-size: 13px !important;
	}
	.items ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
	}
	.items li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		background: #f8fbf7;
		border-radius: 7px;
		font-size: 13px;
	}
	.item-name {
		color: #183126;
		font-weight: 600;
	}
	.item-qty { color: #39754b; font-weight: 700; }

	.order-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 14px;
		padding: 16px 24px;
		background: #f8fbf7;
		border-top: 1px solid #eef4ed;
	}
	.detail-link {
		color: #39754b;
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
	}
	.confirm-btn {
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
	.confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.already {
		color: #2f6a41;
		font-weight: 700;
		font-size: 13px;
		padding: 10px 14px;
		background: #dcebd8;
		border-radius: 7px;
	}

	@media (max-width: 900px) {
		.order-head { flex-direction: column; align-items: flex-start; }
		.status-col { text-align: left; justify-items: start; }
		.order-body { grid-template-columns: 1fr; }
	}
	@media (max-width: 600px) {
		.summary-row { grid-template-columns: 1fr; }
		.order-foot { flex-direction: column; align-items: stretch; }
	}
</style>
