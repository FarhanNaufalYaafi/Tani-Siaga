<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { confirmOrder, getOrderDetail, type OrderDetail } from '$lib/api/order-api';

  let order = $state<OrderDetail | null>(null);
  let isLoading = $state(true);
  let isConfirming = $state(false);
  let errorMessage = $state('');
  let notice = $state('');

  onMount(() => {
    const loadOrder = async () => {
      try {
        const id = page.params.id;
        if (!id) throw new Error('Order tidak ditemukan.');
        const latest = await getOrderDetail(id);
        order = latest;
        errorMessage = '';
      } catch (error: any) {
        if (!order) errorMessage = error.message || 'Gagal memuat detail order.';
      } finally { isLoading = false; }
    };

    void loadOrder();
    const poll = window.setInterval(() => {
      if (order?.status === 'pending') void loadOrder();
    }, 5000);
    return () => window.clearInterval(poll);
  });

  function price(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
  function statusLabel(status: string, shippingMethod?: string) { if (shippingMethod === 'DIRECT_CONTACT') return 'Transaksi langsung'; return ({ pending: 'Menunggu pembayaran', paid: 'Sudah dibayar', completed: 'Selesai', cancel: 'Dibatalkan', challenge: 'Menunggu verifikasi' } as Record<string, string>)[status] || status; }
  async function confirm() {
    if (!order) return;
    isConfirming = true;
    try {
      const result = await confirmOrder(order.order_id);
      order = { ...order, status: result.status, buyer_confirmed: result.buyer_confirmed, seller_confirmed: result.seller_confirmed };
      notice = result.status === 'completed' ? 'Pesanan selesai karena pembeli dan penjual sudah menyetujui.' : 'Persetujuan kamu sudah dicatat. Menunggu pihak lainnya.';
    } catch (error: any) { errorMessage = error.message || 'Gagal mengonfirmasi pesanan.'; }
    finally { isConfirming = false; }
  }
</script>

<svelte:head><title>Detail Pesanan | Tani Siaga</title></svelte:head>
<div class="page-shell"><div class="page-container"><a class="back" href="/pesanan">← Kembali ke pesanan</a>
  {#if isLoading}<div class="state">Memuat detail order...</div>
  {:else if errorMessage && !order}<div class="state error">{errorMessage}</div>
  {:else if order}
    <div class="heading"><div><p class="eyebrow">ORDER #{order.order_id}</p><h1>Detail pesanan</h1><p class="subtitle">{order.midtrans_order_id}</p></div><span class="status">{statusLabel(order.status, order.shipping_info.shipping_method)}</span></div>
    {#if notice}<div class="notice">{notice}</div>{/if}{#if errorMessage}<div class="notice error">{errorMessage}</div>{/if}
    <div class="layout"><section class="card"><p class="eyebrow">PRODUK</p>{#each order.items as item}<div class="item"><div><strong>{item.product_name}</strong><span>{item.quantity} × {price(item.price)}</span></div><strong>{price(item.quantity * item.price)}</strong></div>{/each}<div class="total"><span>Total pesanan</span><strong>{price(order.total_price)}</strong></div></section><aside class="card"><p class="eyebrow">PENGIRIMAN</p><div class="info"><span>Metode</span><strong>{order.shipping_info.shipping_method === 'PICKUP' ? 'Pickup' : 'Hubungi petani'}</strong></div><div class="info"><span>Penerima</span><strong>{order.shipping_info.recipient_name}</strong></div><div class="info"><span>Nomor</span><strong>{order.shipping_info.phone_number}</strong></div><div class="info"><span>Alamat</span><strong>{order.shipping_info.address}</strong></div><a class="wa" href={order.shipping_info.shop_details.wa_link} target="_blank" rel="noreferrer">Hubungi petani via WhatsApp</a></aside></div>
    {#if order.payment_url}<button class="pay" type="button" onclick={() => window.open(order?.payment_url || '', '_blank', 'noopener,noreferrer')}>Bayar melalui Midtrans ↗</button>{/if}
    {#if (order.status === 'paid' || order.status === 'completed') && order.shipping_info.shipping_method !== 'DIRECT_CONTACT'}<section class="confirmation card"><p class="eyebrow">KONFIRMASI SERAH TERIMA</p><div class="checks"><span class:done={order.buyer_confirmed}>Pembeli {order.buyer_confirmed ? 'sudah setuju' : 'belum setuju'}</span><span class:done={order.seller_confirmed}>Penjual {order.seller_confirmed ? 'sudah setuju' : 'belum setuju'}</span></div>{#if order.status !== 'completed' && ((order.can_confirm_buyer && !order.buyer_confirmed) || (order.can_confirm_seller && !order.seller_confirmed))}<button class="confirm" type="button" onclick={confirm} disabled={isConfirming}>{isConfirming ? 'Menyimpan...' : order.can_confirm_seller ? 'Saya setuju sebagai penjual' : 'Saya setuju pesanan selesai'}</button>{/if}<p class="disclaimer">{order.shipping_info.disclaimer}</p></section>{/if}
  {/if}
</div></div>

<style>
  .page-shell{min-height:100vh;background:#f5f7f0;color:#183126;padding:38px 20px 70px}.page-container{max-width:950px;margin:auto}.back{display:inline-block;margin-bottom:28px;color:#39754b;font-size:13px;font-weight:700;text-decoration:none}.heading{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:28px}.eyebrow{margin:0 0 9px;color:#4e805a;font-size:11px;font-weight:800;letter-spacing:.15em}.heading h1{margin:0;font:600 clamp(40px,6vw,65px)/1 'Fraunces',Georgia,serif}.subtitle{color:#718077}.status{border-radius:999px;background:#edf8ed;color:#39754b;padding:9px 12px;font-size:12px;font-weight:800}.layout{display:grid;grid-template-columns:1fr 310px;gap:16px}.card{border:1px solid #d6e1d5;border-radius:10px;background:#fff;padding:22px}.item{display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #e8eee6;padding:15px 0}.item span{display:block;margin-top:5px;color:#718077;font-size:12px}.item>strong,.total strong{color:#39754b}.total{display:flex;justify-content:space-between;padding-top:18px;font-weight:700}.info{display:grid;gap:5px;padding:11px 0;border-bottom:1px solid #e8eee6}.info span{color:#718077;font-size:11px}.info strong{font-size:13px}.wa,.pay,.confirm{display:block;border:0;border-radius:7px;background:#39754b;color:#fff;padding:12px 15px;font:700 12px 'DM Sans',sans-serif;text-align:center;text-decoration:none;cursor:pointer}.wa{margin-top:17px;background:#2f8f54}.pay{margin-top:16px;width:100%;font-size:14px}.confirmation{margin-top:16px}.checks{display:flex;gap:10px;margin:15px 0}.checks span{flex:1;border-radius:7px;background:#fff8e8;color:#98702d;padding:11px;font-size:11px}.checks span.done{background:#edf8ed;color:#39754b}.confirm{margin-top:12px}.disclaimer{color:#718077;font-size:11px;line-height:1.55}.notice,.state{padding:14px;border:1px solid #d6e1d5;border-radius:8px;background:#fff;color:#39754b}.notice{margin-bottom:16px}.notice.error,.state.error{color:#a44242;background:#fff0ef}.state{text-align:center;color:#718077}@media(max-width:700px){.heading{display:block}.status{display:inline-block;margin-top:15px}.layout{grid-template-columns:1fr}.checks{display:grid;grid-template-columns:1fr}}
</style>
