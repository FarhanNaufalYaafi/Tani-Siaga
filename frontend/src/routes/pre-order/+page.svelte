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
			bookedOrders = orders.filter((order) => ['booked', 'harvested', 'payment_created'].includes(order.status));
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
			`Pre-order ${order.product?.name || 'produk pre-order'} sebanyak ${order.quantity} kg akan dibatalkan dan stoknya dilepas. DP ${price(order.depositAmount)} hangus dan tidak dapat dikembalikan.`,
			{ title: 'Batalkan pre-order?', tone: 'warning', confirmLabel: 'Batalkan pre-order', cancelLabel: 'Tetap lanjutkan' },
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

<main class="kerangka-halaman">
	<div class="wadah-halaman">
		<div class="aksi-atas">
			<a class="kembali" href="/e-commerce">← Kembali ke katalog</a>
			<a class="tautan-riwayat" href="/pesanan">Riwayat pesanan</a>
		</div>
		<header class="judul">
			<p class="label-kecil">PESANAN HASIL PANEN</p>
			<h1 class="judul">Pre-order saya</h1>
			<p class="subjudul">Pantau panen dan konfirmasi pre-order saat produk siap.</p>
		</header>

		{#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
		{#if isLoading}
			<div class="keadaan">Memuat pre-order...</div>
		{:else if bookedOrders.length === 0}
			<div class="keadaan">
				<p>Tidak ada pre-order yang menunggu panen atau konfirmasi.</p>
				<a href="/e-commerce">Cari produk pre-order</a>
			</div>
		{:else}
			<div class="daftar-pesanan">
				{#each bookedOrders as order (order.id)}
					<article class="kartu-pesanan">
						{#if order.orderId}
							<a
								class="tautan-kartu-pesanan"
								href={`/pesanan/${order.orderId}`}
								aria-label={`Lihat detail pesanan ${order.product?.name || 'pre-order'}`}
							></a>
						{/if}
						<div class="informasi-pesanan">
							<div class="informasi-pesanan">
								<span>BOOKED #{order.id}</span>
								<span class:siap={order.status === 'harvested' || (order.status === 'payment_created' && order.balancePaymentStatus === 'paid')} class="status">
									{order.status === 'harvested'
										? 'Siap dilunasi'
										: order.status === 'payment_created'
											? order.balancePaymentStatus === 'paid' ? 'Sudah dibayar · Menunggu konfirmasi' : 'Menunggu pembayaran pelunasan'
											: 'Menunggu panen'}
								</span>
							</div>
							<h2>{order.product?.name || 'Produk pre-order'}</h2>
							<strong>{price(order.totalPrice)}</strong>
							<p>DP dibayar {price(order.depositAmount)} · Pelunasan {price(order.remainingAmount)}</p>
							<p>{order.quantity} kg · {harvestDate(order.estimatedHarvestDate)}</p>
						</div>
						<div class="aksi">
							{#if order.status === 'harvested'}
								<button class="utama" onclick={() => continueOrder(order)} disabled={actionId === order.id}>
									{actionId === order.id ? 'Memproses...' : `Pelunasan ${price(order.remainingAmount)}`}
								</button>
							{/if}
							{#if order.status === 'booked' || order.status === 'harvested'}
								<button class="batal" onclick={() => cancelOrder(order)} disabled={actionId === order.id}>
									Batalkan
								</button>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</main>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		padding: 38px 20px 70px;
		background: #f5f7f0;
		color: #183126;
	}
	.wadah-halaman {
		width: min(100%, 930px);
		margin: 0 auto;
	}
	.aksi-atas {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 34px;
	}
	.kembali {
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.tautan-riwayat {
		border: 1px solid #a9c9aa;
		border-radius: 7px;
		padding: 10px 13px;
		background: #fff;
		color: #39754b;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
	}
	.judul {
		margin-bottom: 28px;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .15em;
	}
	h1 {
		margin: 0;
		font: 600 clamp(40px, 6vw, 65px)/1 'Fraunces', Georgia, serif;
	}
	.subjudul {
		color: #718077;
	}
	.daftar-pesanan {
		display: grid;
		gap: 12px;
	}
	.kartu-pesanan {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		border: 1px solid #d6e1d5;
		border-radius: 9px;
		padding: 19px;
		background: #fff;
		cursor: pointer;
	}
	.tautan-kartu-pesanan {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: inherit;
	}
	.tautan-kartu-pesanan:focus-visible {
		outline: 2px solid #39754b;
		outline-offset: 3px;
	}
	.informasi-pesanan {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		color: #718077;
		font-size: 10px;
		letter-spacing: .08em;
	}
	.status {
		border-radius: 999px;
		padding: 6px 9px;
		background: #fff4dc;
		color: #a8762e;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0;
	}
	.status.siap {
		background: #edf8ed;
		color: #39754b;
	}
	h2 {
		margin: 9px 0 5px;
		font-size: 17px;
	}
	.informasi-pesanan > strong {
		color: #39754b;
		font-size: 14px;
	}
	.informasi-pesanan p {
		margin: 7px 0 0;
		color: #718077;
		font-size: 12px;
	}
	.aksi {
		position: relative;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
	}
	.aksi button {
		border: 0;
		border-radius: 6px;
		padding: 9px 12px;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.utama {
		background: #39754b;
		color: #fff;
	}
	.batal {
		border: 1px solid #d6b8a8 !important;
		background: #fff;
		color: #a44242;
	}
	.aksi button:disabled {
		opacity: .55;
		cursor: wait;
	}
	.keadaan, .peringatan {
		border: 1px solid #d6e1d5;
		border-radius: 9px;
		padding: 28px;
		background: #fff;
		color: #718077;
		text-align: center;
	}
	.keadaan p {
		margin: 0;
	}
	.keadaan a {
		display: inline-block;
		margin-top: 14px;
		color: #39754b;
		font-weight: 700;
		text-decoration: none;
	}
	.peringatan.galat {
		margin-bottom: 14px;
		border-color: #e6c2bc;
		background: #fff0ef;
		color: #a44242;
		text-align: left;
	}
	@media (max-width: 620px) {
		.kerangka-halaman {
			padding: 30px 16px 56px;
		}
		.kartu-pesanan {
			align-items: flex-start;
			flex-direction: column;
		}
		.aksi {
			justify-content: flex-start;
		}
		.aksi-atas {
			align-items: flex-start;
		}
	}
</style>