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
<div class="page-shell">
  <div class="page-container">
    <a class="back" href="/keranjang">← Kembali ke keranjang</a>
    <div class="heading">
      <div><p class="eyebrow">AKTIVITAS BELANJA</p><h1>Riwayat pesanan</h1><p class="subtitle">Lihat status pembayaran, pengiriman, dan transaksi sebelumnya.</p></div>
      <a class="preorders-link" href="/pre-order">Pre-order aktif →</a>
    </div>
    {#if isLoading}
      <div class="state">Memuat pesanan...</div>
    {:else if errorMessage}
      <div class="state error">{errorMessage}</div>
    {:else}
      {#if orders.length === 0 && bookedOrders.length === 0}
        <div class="state">Belum ada riwayat pesanan.<a href="/e-commerce">Mulai belanja</a></div>
      {:else}
        {#if orders.length > 0}
          <div class="order-list">
            {#each orders as order (order.order_id)}
              <a class="order-card" href={`/pesanan/${order.order_id}`}>
                <div><span class="order-id">ORDER #{order.order_id} · {order.midtrans_order_id}</span><h2>{order.total_items} item · {price(order.total_price)}</h2><p>{order.shipping_method === 'PICKUP' ? 'Pickup' : 'Hubungi petani'} · {order.recipient_name}</p></div>
                <div class="status"><span>{label(order.status)}</span><small>{order.created_at ? new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(order.created_at)) : '-'}</small></div>
              </a>
            {/each}
          </div>
        {/if}
        {#if bookedOrders.length > 0}
          <section class="booked-section">
            <div class="section-heading"><div><p class="eyebrow">PRE-ORDER</p><h2>Pre-order dibatalkan</h2></div><span>Riwayat pembatalan</span></div>
            <div class="order-list">
              {#each bookedOrders as item (item.id)}
                <article class="order-card">
                  <div><span class="order-id">BOOKED #{item.id} · {bookedLabel(item.status)}</span><h2>{item.product?.name || 'Produk pre-order'} · {price(item.totalPrice)}</h2><p>{item.quantity} kg · {item.estimatedHarvestDate ? `Perkiraan panen ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(item.estimatedHarvestDate))}` : 'Tanggal panen belum tersedia'}</p></div>
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
  .page-shell{min-height:100vh;background:#f5f7f0;color:#183126;padding:38px 20px 70px}.page-container{max-width:930px;margin:auto}.back{display:inline-block;margin-bottom:28px;color:#39754b;font-size:13px;font-weight:700;text-decoration:none}.heading{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:28px}.preorders-link{border-radius:7px;background:#183126;color:#fff;padding:11px 14px;font-size:12px;font-weight:700;text-decoration:none}.eyebrow{margin:0 0 9px;color:#4e805a;font-size:11px;font-weight:800;letter-spacing:.15em}.heading h1{margin:0;font:600 clamp(40px,6vw,65px)/1 'Fraunces',Georgia,serif}.subtitle{color:#718077}.booked-section{margin-bottom:28px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:12px}.section-heading h2{margin:0;font-size:21px}.section-heading>span{color:#a8762e;font-size:11px;font-weight:700}.order-list{display:grid;gap:12px}.order-card{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:19px;border:1px solid #d6e1d5;border-radius:9px;background:#fff;color:#183126;text-decoration:none;transition:transform .2s,box-shadow .2s}.order-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px #23472e14}.order-id{color:#718077;font-size:10px;letter-spacing:.08em}.order-card h2{margin:8px 0 5px;font-size:17px}.order-card p{margin:0;color:#718077;font-size:12px}.status{text-align:right}.status span{display:block;border-radius:999px;background:#edf8ed;color:#39754b;padding:7px 10px;font-size:11px;font-weight:700}.status small{display:block;margin-top:8px;color:#829087;font-size:10px}.state{padding:40px;text-align:center;border:1px solid #d6e1d5;border-radius:10px;background:#fff;color:#718077}.state a{display:block;margin-top:12px;color:#39754b;font-weight:700}.state.error{color:#a44242;background:#fff0ef}@media(max-width:600px){.heading,.order-card{align-items:flex-start;flex-direction:column}.status{text-align:left}.section-heading{align-items:flex-start;flex-direction:column;gap:5px}}
</style>
