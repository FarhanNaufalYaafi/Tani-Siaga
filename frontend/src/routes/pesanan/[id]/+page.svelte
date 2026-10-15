<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { confirmOrder, getOrderDetail, type OrderDetail } from '$lib/api/order-api';
  import { getProductReviewEligibility, type ProductReviewEligibility } from '$lib/api/product-api';
  import { showConfirm } from '$lib/services/dialog';

  let order = $state<OrderDetail | null>(null);
  let isLoading = $state(true);
  let isConfirming = $state(false);
  let errorMessage = $state('');
  let notice = $state('');
  let reviewStatusByProduct = $state<Record<number, ProductReviewEligibility>>({});
  let reviewActionError = $state('');

  async function loadReviewStatuses(currentOrder: OrderDetail) {
    const productIds = [...new Set(currentOrder.items.map((item) => item.product_id))];
    try {
      const entries = await Promise.all(productIds.map(async (productId) => [
        productId,
        await getProductReviewEligibility(productId),
      ] as const));
      reviewStatusByProduct = Object.fromEntries(entries);
      reviewActionError = '';
    } catch (error) {
      reviewActionError = error instanceof Error ? error.message : 'Gagal memeriksa status ulasan.';
    }
  }

  onMount(() => {
    const loadOrder = async () => {
      try {
        const id = page.params.id;
        if (!id) throw new Error('Order tidak ditemukan.');
        const latest = await getOrderDetail(id);
        order = latest;
        if (latest.status === 'completed') await loadReviewStatuses(latest);
        else reviewStatusByProduct = {};
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
  function getReviewLink(productId: number) {
    return `/e-commerce/${productId}#ulasan-pembeli`;
  }
  function reviewActionLabel(productId: number) {
    const reviewStatus = reviewStatusByProduct[productId];
    if (reviewStatus?.has_review) return 'Perbarui ulasan?';
    if (reviewStatus?.eligible) return 'Berikan ulasan';
    return null;
  }
  async function confirm() {
    if (!order) return;
    if (!order.can_confirm_seller) {
      const productReceived = await showConfirm(
        'Pastikan produk sudah berada di tanganmu sebelum menyelesaikan pesanan. Jika produk belum diterima, jangan konfirmasi.',
        {
          title: 'Pastikan produk sudah diterima',
          tone: 'warning',
          confirmLabel: 'Ya, produk sudah diterima',
          cancelLabel: 'Belum diterima',
        },
      );
      if (!productReceived) return;
    }

    isConfirming = true;
    try {
      const result = await confirmOrder(order.order_id);
      order = { ...order, status: result.status, buyer_confirmed: result.buyer_confirmed, seller_confirmed: result.seller_confirmed };
      if (order.status === 'completed') await loadReviewStatuses(order);
      else reviewStatusByProduct = {};
      notice = result.status === 'completed' ? 'Pesanan selesai karena pembeli dan penjual sudah menyetujui.' : 'Persetujuan kamu sudah dicatat. Menunggu pihak lainnya.';
    } catch (error: any) { errorMessage = error.message || 'Gagal mengonfirmasi pesanan.'; }
    finally { isConfirming = false; }
  }
</script>

<svelte:head><title>Detail Pesanan | Tani Siaga</title></svelte:head>
<div class="kerangka-halaman"><div class="wadah-halaman"><a class="kembali" href="/pesanan">← Kembali ke pesanan</a>
  {#if isLoading}<div class="keadaan">Memuat detail order...</div>
  {:else if errorMessage && !order}<div class="keadaan galat">{errorMessage}</div>
  {:else if order}
    <div class="judul"><div><p class="label-kecil">ORDER #{order.order_id}</p><h1 class="judul">Detail pesanan</h1><p class="subjudul">{order.midtrans_order_id}</p></div><span class="status">{statusLabel(order.status, order.shipping_info.shipping_method)}</span></div>
    {#if notice}<div class="peringatan">{notice}</div>{/if}{#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
    <div class="tata">
      <section class="kartu">
        <p class="label-kecil">PRODUK</p>
        {#each order.items as item}
          <div class="butir">
            <div><strong>{item.product_name}</strong><span>{item.quantity} × {price(item.price)}</span></div>
            <strong>{price(item.quantity * item.price)}</strong>
          </div>
        {/each}
        {#if order.is_preorder_order}
          <div class="total total-pembayaran">
            <span>{order.midtrans_order_id.startsWith('PO-DP-') ? 'Tagihan DP 30%' : 'Tagihan pelunasan'}</span>
            <strong>{price(order.payment_amount || 0)}</strong>
          </div>
          <div class="total total-pendukung"><span>Total nilai pre-order</span><strong>{price(order.total_price)}</strong></div>
        {:else}
          <div class="total"><span>Total pesanan</span><strong>{price(order.total_price)}</strong></div>
        {/if}
      </section>
      <aside class="kartu">
        <p class="label-kecil">PENGIRIMAN</p>
        <div class="informasi"><span>Metode</span><strong>{order.shipping_info.shipping_method === 'PICKUP' ? 'Pickup' : 'Hubungi petani'}</strong></div>
        <div class="informasi"><span>Penerima</span><strong>{order.shipping_info.recipient_name}</strong></div>
        <div class="informasi"><span>Nomor</span><strong>{order.shipping_info.phone_number}</strong></div>
        <div class="informasi"><span>Alamat</span><strong>{order.shipping_info.address}</strong></div>
        {#if !order.is_preorder_order}
          <a class="wa" href={order.shipping_info.shop_details.wa_link} target="_blank" rel="noreferrer">Hubungi petani via WhatsApp</a>
        {/if}
        {#if order.shipping_info.shipping_method === 'DIRECT_CONTACT' && order.status === 'completed' && !order.is_preorder_deposit}
          {#each order.items as item (item.product_id)}
            {@const reviewLabel = reviewActionLabel(item.product_id)}
            {#if reviewLabel}
              <a class="tautan-ulasan" href={getReviewLink(item.product_id)}>{reviewLabel} · {item.product_name}</a>
            {/if}
          {/each}
        {/if}
      </aside>
    </div>
    {#if order.payment_url}<button class="bayar" type="button" onclick={() => window.open(order?.payment_url || '', '_blank', 'noopener,noreferrer')}>Bayar melalui Midtrans ↗</button>{/if}
    {#if !order.is_preorder_deposit && (order.status === 'paid' || order.status === 'completed') && order.shipping_info.shipping_method !== 'DIRECT_CONTACT'}<section class="konfirmasi kartu"><p class="label-kecil">KONFIRMASI SERAH TERIMA</p><div class="centang"><span class:selesai={order.buyer_confirmed}>Pembeli {order.buyer_confirmed ? 'sudah setuju' : 'belum setuju'}</span><span class:selesai={order.seller_confirmed}>Penjual {order.seller_confirmed ? 'sudah setuju' : 'belum setuju'}</span></div>{#if order.status !== 'completed' && ((order.can_confirm_buyer && !order.buyer_confirmed) || (order.can_confirm_seller && !order.seller_confirmed))}<button class="konfirmasi" type="button" onclick={confirm} disabled={isConfirming}>{isConfirming ? 'Menyimpan...' : order.can_confirm_seller ? 'Saya setuju sebagai penjual' : 'Saya setuju pesanan selesai'}</button>{/if}{#if order.status === 'completed'}<div class="ulasan-pesanan">{#each order.items as item (item.product_id)}{@const reviewLabel = reviewActionLabel(item.product_id)}{#if reviewLabel}<a class="tautan-ulasan" href={getReviewLink(item.product_id)}>{reviewLabel} · {item.product_name}</a>{/if}{/each}</div>{/if}<p class="catatan">{order.shipping_info.disclaimer}</p></section>{/if}
    {#if reviewActionError}<p class="galat-ulasan">{reviewActionError}</p>{/if}
  {/if}
</div></div>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f5f7f0;
		color: #183126;
		padding: 38px 20px 70px;
	}
	.wadah-halaman {
		max-width: 950px;
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
	.status {
		border-radius: 999px;
		background: #edf8ed;
		color: #39754b;
		padding: 9px 12px;
		font-size: 12px;
		font-weight: 800;
	}
	.tata {
		display: grid;
		grid-template-columns: 1fr 310px;
		gap: 16px;
	}
	.kartu {
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 22px;
	}
	.butir {
		display: flex;
		justify-content: space-between;
		gap: 15px;
		border-bottom: 1px solid #e8eee6;
		padding: 15px 0;
	}
	.butir span {
		display: block;
		margin-top: 5px;
		color: #718077;
		font-size: 12px;
	}
	.butir>strong,.total strong {
		color: #39754b;
	}
	.total {
		display: flex;
		justify-content: space-between;
		padding-top: 18px;
		font-weight: 700;
	}
	.informasi {
		display: grid;
		gap: 5px;
		padding: 11px 0;
		border-bottom: 1px solid #e8eee6;
	}
	.informasi span {
		color: #718077;
		font-size: 11px;
	}
	.informasi strong {
		font-size: 13px;
	}
	.wa,.bayar,.konfirmasi,.tautan-ulasan {
		display: block;
		border: 0;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 12px 15px;
		font: 700 12px 'DM Sans',sans-serif;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
	}
	.wa {
		margin-top: 17px;
		background: #2f8f54;
	}
	.tautan-ulasan {
		margin-top: 12px;
		background: #eaf5e8;
		border: 1px solid #bad6b7;
		color: #27623c;
	}
	.bayar {
		margin-top: 16px;
		width: 100%;
		font-size: 14px;
	}
	.konfirmasi {
		margin-top: 16px;
	}
	.centang {
		display: flex;
		gap: 10px;
		margin: 15px 0;
	}
	.centang span {
		flex: 1;
		border-radius: 7px;
		background: #fff8e8;
		color: #98702d;
		padding: 11px;
		font-size: 11px;
	}
	.centang span.selesai {
		background: #edf8ed;
		color: #39754b;
	}
	.konfirmasi {
		margin-top: 12px;
	}
	.catatan {
		color: #718077;
		font-size: 11px;
		line-height: 1.55;
	}
	.peringatan,.keadaan {
		padding: 14px;
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #fff;
		color: #39754b;
	}
	.peringatan {
		margin-bottom: 16px;
	}
	.peringatan.galat,.keadaan.galat,.galat-ulasan {
		color: #a44242;
		background: #fff0ef;
	}
	.galat-ulasan {
		border: 1px solid #edc9c6;
		border-radius: 8px;
		padding: 12px;
	}
	.ulasan-pesanan {
		margin-top: 12px;
	}
	.ulasan-pesanan .tautan-ulasan {
		margin-top: 8px;
	}
	.keadaan {
		text-align: center;
		color: #718077;
	}
	@media (max-width:700px) {
		.judul {
			display: block;
		}
		.status {
			display: inline-block;
			margin-top: 15px;
		}
		.tata {
			grid-template-columns: 1fr;
		}
		.centang {
			display: grid;
			grid-template-columns: 1fr;
		}
	}
	.total-pendukung {
		margin-top: 8px;
		border-top: 1px solid #e8eee6;
		color: #718077;
		font-size: 12px;
		font-weight: 500;
	}
	.total-pendukung strong {
		color: #52685a;
		font-weight: 600;
	}
</style>
