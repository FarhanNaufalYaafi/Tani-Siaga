<script lang="ts">
  import { onMount } from 'svelte';
  import { getBookedOrders, getOrders, getSellerOrders, type BookedOrder, type OrderSummary } from '$lib/api/order-api';
  let orders = $state<OrderSummary[]>([]); let isLoading = $state(true); let errorMessage = $state('');
  let bookedOrders = $state<BookedOrder[]>([]);
  onMount(async () => { try { const [buyerOrders, sellerOrders, booked] = await Promise.all([getOrders(), getSellerOrders().catch(() => []), getBookedOrders().catch(() => [])]); orders = [...buyerOrders, ...sellerOrders.filter((seller) => !buyerOrders.some((buyer) => buyer.order_id === seller.order_id))].sort((a, b) => b.order_id - a.order_id); bookedOrders = booked.filter((item) => item.status === 'cancelled' || item.status === 'expired'); } catch (error: any) { errorMessage = error.message || 'Gagal memuat riwayat pesanan.'; } finally { isLoading = false; } });
  function price(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
  function label(status: string) { return ({ pending: 'Menunggu pembayaran', paid: 'Sudah dibayar', completed: 'Selesai', cancel: 'Dibatalkan', challenge: 'Menunggu verifikasi' } as Record<string,string>)[status] || status; }
  function bookedLabel(status: BookedOrder['status']) { return ({ booked: 'Menunggu panen', harvested: 'Siap dikonfirmasi', payment_created: 'Menunggu pembayaran', cancelled: 'Dibatalkan', expired: 'Dibatalkan' } as Record<string, string>)[status] || status; }
</script>
<svelte:head><title>Riwayat Pesanan | Tani Siaga</title></svelte:head>
<div class="kerangka-halaman">
  <div class="wadah-halaman">
    <a class="kembali" href="/keranjang">← Kembali ke keranjang</a>
    <div class="judul">
      <div><p class="label-kecil">AKTIVITAS BELANJA</p><h1 class="judul">Riwayat pesanan</h1><p class="subjudul">Lihat status pembayaran, pengiriman, dan transaksi sebelumnya.</p></div>
      <a class="tautan-pra-pesan" href="/pre-order">Pre-order aktif →</a>
    </div>
    {#if isLoading}
      <div class="keadaan">Memuat pesanan...</div>
    {:else if errorMessage}
      <div class="keadaan galat">{errorMessage}</div>
    {:else}
      {#if orders.length === 0 && bookedOrders.length === 0}
        <div class="keadaan">Belum ada riwayat pesanan.<a href="/e-commerce">Mulai belanja</a></div>
      {:else}
        {#if orders.length > 0}
          <div class="daftar-pesanan">
            {#each orders as order (order.order_id)}
              <a class="kartu-pesanan" href={`/pesanan/${order.order_id}`}>
                <div><span class="id-pesanan">ORDER #{order.order_id} · {order.midtrans_order_id}</span><h2>{order.total_items} item · {price(order.total_price)}</h2><p>{order.shipping_method === 'PICKUP' ? 'Pickup' : 'Hubungi petani'} · {order.recipient_name}</p></div>
                <div class="status"><span>{label(order.status)}</span><small>{order.created_at ? new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(order.created_at)) : '-'}</small></div>
              </a>
            {/each}
          </div>
        {/if}
        {#if bookedOrders.length > 0}
          <section class="bagian-dipesan">
            <div class="judul-bagian"><div><p class="label-kecil">PRE-ORDER</p><h2>Pre-order dibatalkan</h2></div><span>Riwayat pembatalan</span></div>
            <div class="daftar-pesanan">
              {#each bookedOrders as item (item.id)}
                <article class="kartu-pesanan">
                  <div><span class="id-pesanan">BOOKED #{item.id} · {bookedLabel(item.status)}</span><h2>{item.product?.name || 'Produk pre-order'} · {price(item.totalPrice)}</h2><p>{item.quantity} kg · {item.estimatedHarvestDate ? `Perkiraan panen ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(item.estimatedHarvestDate))}` : 'Tanggal panen belum tersedia'}</p></div>
                  <div class="status"><span>Dibatalkan</span></div>
                </article>
              {/each}
            </div>
          </section>
        {/if}
      {/if}
    {/if}
  </div>
</div>
<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f5f7f0;
		color: #183126;
		padding: 38px 20px 70px;
	}
	.wadah-halaman {
		max-width: 930px;
		margin: auto;
	}
	.kembali {
		display: inline-block;
		margin-bottom: 28px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.judul {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 18px;
		margin-bottom: 28px;
	}
	.tautan-pra-pesan {
		border-radius: 7px;
		background: #183126;
		color: #fff;
		padding: 11px 14px;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .15em;
	}
	.judul h1 {
		margin: 0;
		font: 600 clamp(40px,6vw,65px)/1 'Fraunces',Georgia,serif;
	}
	.subjudul {
		color: #718077;
	}
	.bagian-dipesan {
		margin-bottom: 28px;
	}
	.judul-bagian {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 12px;
	}
	.judul-bagian h2 {
		margin: 0;
		font-size: 21px;
	}
	.judul-bagian>span {
		color: #a8762e;
		font-size: 11px;
		font-weight: 700;
	}
	.daftar-pesanan {
		display: grid;
		gap: 12px;
	}
	.kartu-pesanan {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
		padding: 19px;
		border: 1px solid #d6e1d5;
		border-radius: 9px;
		background: #fff;
		color: #183126;
		text-decoration: none;
		transition: transform .2s,box-shadow .2s;
	}
	.kartu-pesanan:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 22px #23472e14;
	}
	.id-pesanan {
		color: #718077;
		font-size: 10px;
		letter-spacing: .08em;
	}
	.kartu-pesanan h2 {
		margin: 8px 0 5px;
		font-size: 17px;
	}
	.kartu-pesanan p {
		margin: 0;
		color: #718077;
		font-size: 12px;
	}
	.status {
		text-align: right;
	}
	.status span {
		display: block;
		border-radius: 999px;
		background: #edf8ed;
		color: #39754b;
		padding: 7px 10px;
		font-size: 11px;
		font-weight: 700;
	}
	.status small {
		display: block;
		margin-top: 8px;
		color: #829087;
		font-size: 10px;
	}
	.keadaan {
		padding: 40px;
		text-align: center;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		color: #718077;
	}
	.keadaan a {
		display: block;
		margin-top: 12px;
		color: #39754b;
		font-weight: 700;
	}
	.keadaan.galat {
		color: #a44242;
		background: #fff0ef;
	}
	@media (max-width:600px) {
		.judul,.kartu-pesanan {
			align-items: flex-start;
			flex-direction: column;
		}
		.status {
			text-align: left;
		}
		.judul-bagian {
			align-items: flex-start;
			flex-direction: column;
			gap: 5px;
		}
	}
</style>
