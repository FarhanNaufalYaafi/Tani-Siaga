<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		cancelBookedOrder,
		confirmBookedOrder,
		getBookedOrders,
		type BookedOrder,
	} from '$lib/api/order-api';
	import { showAlert, showConfirm } from '$lib/services/dialog';

	let bookedOrders = $state<BookedOrder[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let actionId = $state<number | null>(null);

	onMount(async () => {
		try {
			const orders = await getBookedOrders();
			bookedOrders = orders.filter((order) => order.status === 'booked' || order.status === 'harvested');
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat pre-order.';
		} finally {
			isLoading = false;
		}
	});

	function price(value: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function harvestDate(value?: string | null) {
		return value
			? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
			: 'Tanggal panen belum tersedia';
	}

	async function continueOrder(order: BookedOrder) {
		actionId = order.id;
		errorMessage = '';
		try {
			const result = await confirmBookedOrder(order.id);
			bookedOrders = bookedOrders.filter((item) => item.id !== order.id);
			if (result.paymentURL) window.open(result.paymentURL, '_blank', 'noopener,noreferrer');
			if (result.orderId) await goto(`/pesanan/${result.orderId}`);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal membuat pembayaran.';
		} finally {
			actionId = null;
		}
	}

	async function cancelOrder(order: BookedOrder) {
		const confirmed = await showConfirm(
			`Booking ${order.product?.name || 'produk pre-order'} sebanyak ${order.quantity} kg akan dibatalkan dan kuotanya dilepas.`,
			{ title: 'Batalkan pre-order?', confirmLabel: 'Ya, batalkan', cancelLabel: 'Tetap lanjutkan' },
		);
		if (!confirmed) return;
		actionId = order.id;
		try {
			await cancelBookedOrder(order.id);
			bookedOrders = bookedOrders.filter((item) => item.id !== order.id);
		} catch (error: any) {
			await showAlert(error.message || 'Gagal membatalkan booked order.', { title: 'Pembatalan gagal', tone: 'error' });
		} finally {
			actionId = null;
		}
	}
</script>

<svelte:head><title>Pre-order Saya | Tani Siaga</title></svelte:head>

<main class="page-shell">
	<div class="page-container">
		<div class="top-actions">
			<a class="back" href="/e-commerce">← Kembali ke katalog</a>
			<a class="history-link" href="/pesanan">Riwayat pesanan</a>
		</div>
		<header class="heading">
			<p class="eyebrow">PESANAN HASIL PANEN</p>
			<h1>Pre-order saya</h1>
			<p class="subtitle">Pantau panen dan konfirmasi pre-order saat produk siap.</p>
		</header>

		{#if errorMessage}<div class="notice error">{errorMessage}</div>{/if}
		{#if isLoading}
			<div class="state">Memuat pre-order...</div>
		{:else if bookedOrders.length === 0}
			<div class="state">
				<p>Tidak ada pre-order yang menunggu panen atau konfirmasi.</p>
				<a href="/e-commerce">Cari produk pre-order</a>
			</div>
		{:else}
			<div class="order-list">
				{#each bookedOrders as order (order.id)}
					<article class="order-card">
						<div class="order-info">
							<div class="order-meta">
								<span>BOOKED #{order.id}</span>
								<span class:ready={order.status === 'harvested'} class="status">
									{order.status === 'harvested' ? 'Siap dikonfirmasi' : 'Menunggu panen'}
								</span>
							</div>
							<h2>{order.product?.name || 'Produk pre-order'}</h2>
							<strong>{price(order.totalPrice)}</strong>
							<p>{order.quantity} kg · {harvestDate(order.estimatedHarvestDate)}</p>
						</div>
						<div class="actions">
							{#if order.status === 'harvested'}
								<button class="primary" onclick={() => continueOrder(order)} disabled={actionId === order.id}>
									{actionId === order.id ? 'Memproses...' : 'Lanjutkan bayar'}
								</button>
							{/if}
							<button class="cancel" onclick={() => cancelOrder(order)} disabled={actionId === order.id}>
								Batalkan
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</main>

<style>
	.page-shell { min-height: 100vh; padding: 38px 20px 70px; background: #f5f7f0; color: #183126; }
	.page-container { width: min(100%, 930px); margin: 0 auto; }
	.top-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 34px; }
	.back { color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.history-link { border: 1px solid #a9c9aa; border-radius: 7px; padding: 10px 13px; background: #fff; color: #39754b; font-size: 12px; font-weight: 700; text-decoration: none; }
	.heading { margin-bottom: 28px; }
	.eyebrow { margin: 0 0 9px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .15em; }
	h1 { margin: 0; font: 600 clamp(40px, 6vw, 65px)/1 'Fraunces', Georgia, serif; }
	.subtitle { color: #718077; }
	.order-list { display: grid; gap: 12px; }
	.order-card { display: flex; align-items: center; justify-content: space-between; gap: 24px; border: 1px solid #d6e1d5; border-radius: 9px; padding: 19px; background: #fff; }
	.order-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: #718077; font-size: 10px; letter-spacing: .08em; }
	.status { border-radius: 999px; padding: 6px 9px; background: #fff4dc; color: #a8762e; font-size: 10px; font-weight: 700; letter-spacing: 0; }
	.status.ready { background: #edf8ed; color: #39754b; }
	h2 { margin: 9px 0 5px; font-size: 17px; }
	.order-info > strong { color: #39754b; font-size: 14px; }
	.order-info p { margin: 7px 0 0; color: #718077; font-size: 12px; }
	.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
	.actions button { border: 0; border-radius: 6px; padding: 9px 12px; font-size: 11px; font-weight: 700; cursor: pointer; }
	.primary { background: #39754b; color: #fff; }
	.cancel { border: 1px solid #d6b8a8 !important; background: #fff; color: #a44242; }
	.actions button:disabled { opacity: .55; cursor: wait; }
	.state, .notice { border: 1px solid #d6e1d5; border-radius: 9px; padding: 28px; background: #fff; color: #718077; text-align: center; }
	.state p { margin: 0; }
	.state a { display: inline-block; margin-top: 14px; color: #39754b; font-weight: 700; text-decoration: none; }
	.notice.error { margin-bottom: 14px; border-color: #e6c2bc; background: #fff0ef; color: #a44242; text-align: left; }
	@media (max-width: 620px) { .page-shell { padding: 30px 16px 56px; }.order-card { align-items: flex-start; flex-direction: column; }.actions { justify-content: flex-start; }.top-actions { align-items: flex-start; } }
</style>