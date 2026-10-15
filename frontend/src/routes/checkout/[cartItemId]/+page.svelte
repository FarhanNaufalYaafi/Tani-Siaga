<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { createBuyNowPaymentOrder, createPaymentOrder, reviewBuyNowOrder, reviewOrder, type OrderReview, type ShippingMethod } from '$lib/api/order-api';
  let review = $state<OrderReview | null>(null); let isLoading = $state(true); let isSaving = $state(false); let errorMessage = $state(''); let selectedMethod = $state<ShippingMethod>('PICKUP'); let recipientName = $state(''); let phone = $state(''); let address = $state('');
  let buyNowProductId = $state<number | null>(null); let buyNowQuantity = $state(1);
  onMount(async () => { try { const routeId = page.params.cartItemId; const buyNowMatch = routeId?.match(/^buy-now-(\d+)$/); if (buyNowMatch) { buyNowProductId = Number(buyNowMatch[1]); buyNowQuantity = Math.max(1, Math.floor(Number(page.url.searchParams.get('quantity')) || 1)); review = await reviewBuyNowOrder(buyNowProductId, buyNowQuantity); } else { if (!routeId) throw new Error('Item keranjang tidak ditemukan.'); review = await reviewOrder(Number(routeId)); } selectedMethod = review.item.is_pre_order ? 'PICKUP' : review.available_shipping_methods[0] || 'PICKUP'; recipientName = review.shipping_address.recipient_name; phone = review.shipping_address.phone_number; address = review.shipping_address.address; } catch (error: any) { errorMessage = error.message || 'Gagal memuat checkout.'; } finally { isLoading = false; } });
  function price(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!review) return;
    isSaving = true;
    errorMessage = '';
      let paymentWindow: Window | null = null;
      if (buyNowProductId !== null || review.item.is_pre_order) paymentWindow = window.open('about:blank', '_blank');
    try {
      const payload = {
        recipient_name: recipientName.trim(),
        recipient_phone_number: phone.trim(),
        recipient_address: address.trim(),
        shipping_method: selectedMethod,
      };
      const result = buyNowProductId
        ? await createBuyNowPaymentOrder(buyNowProductId, buyNowQuantity, payload)
        : await createPaymentOrder(review.item.cart_item_id, payload);
      if (result.bookedOrderId) {
        if (result.paymentURL && paymentWindow) {
          paymentWindow.opener = null;
          paymentWindow.location.href = result.paymentURL;
        } else if (result.paymentURL) {
          window.open(result.paymentURL, '_blank', 'noopener,noreferrer');
        } else {
          paymentWindow?.close();
        }
        if (result.orderId) await goto(`/pesanan/${result.orderId}`);
        else await goto('/pre-order');
        return;
      }
      if (!result.orderId) throw new Error('Order tidak berhasil dibuat.');
      if (result.paymentURL && paymentWindow) {
        paymentWindow.opener = null;
        paymentWindow.location.href = result.paymentURL;
      } else if (result.paymentURL) {
        window.open(result.paymentURL, '_blank', 'noopener,noreferrer');
      } else {
        paymentWindow?.close();
      }
      await goto(`/pesanan/${result.orderId}`);
    } catch (error: any) {
      paymentWindow?.close();
      errorMessage = error.message || 'Gagal membuat pesanan.';
    } finally {
      isSaving = false;
    }
  }
</script>
<svelte:head><title>Checkout | Tani Siaga</title></svelte:head>
<div class="kerangka-halaman">
  <div class="wadah-halaman">
    <a class="kembali" href="/keranjang">← Kembali ke keranjang</a>
    {#if isLoading}
      <div class="keadaan">Memuat checkout...</div>
    {:else if errorMessage && !review}
      <div class="keadaan galat">{errorMessage}</div>
    {:else if review}
      <div class="judul">
        <div>
          <p class="label-kecil">CHECKOUT</p>
          <h1 class="judul">Konfirmasi pesanan</h1>
          <p class="subjudul">Isi informasi penerima dan pilih cara pengiriman sebelum membuat pesanan.</p>
        </div>
      </div>
      {#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
      <div class="tata-bayar">
        <form class="kartu-formulir" onsubmit={submit}>
          <div class="bagian-formulir">
            <p class="label-kecil">INFORMASI PENERIMA</p>
            <label>Nama penerima<input bind:value={recipientName} required /></label>
            <label>Nomor WhatsApp / telepon<input type="tel" bind:value={phone} required /></label>
            <label>Alamat penerima<input bind:value={address} required placeholder="Alamat lengkap atau titik pengambilan" /></label>
          </div>
          <div class="bagian-formulir">
            <p class="label-kecil">METODE PENGIRIMAN</p>
            <div class="kisi-metode">
              <label class:terpilih={selectedMethod === 'PICKUP'}>
                <input type="radio" bind:group={selectedMethod} value="PICKUP" />
                <strong>Pickup</strong>
                <span>Ambil atau sepakati serah terima dengan petani.</span>
              </label>
              <label class:terpilih={selectedMethod === 'DIRECT_CONTACT'} class:tidak={review.item.is_pre_order} aria-disabled={review.item.is_pre_order}>
                <input type="radio" bind:group={selectedMethod} value="DIRECT_CONTACT" disabled={review.item.is_pre_order} />
                <strong>Hubungi penjual via WhatsApp</strong>
                <span>{review.item.is_pre_order ? 'Belum tersedia untuk pre-order.' : 'Transaksi langsung dengan penjual melalui WhatsApp.'}</span>
              </label>
            </div>
            {#if review.item.is_pre_order}
              <p class="catatan-ambil-pra-pesan">Pre-order hanya menerima Pickup. Jika ingin opsi lain, silakan hubungi penjual melalui kontak yang tersedia di dashboard toko penjual.</p>
            {/if}
          </div>
          <button class="kirim" type="submit" disabled={isSaving}>
            {isSaving ? 'Membuat pesanan...' : review.item.is_pre_order ? `Bayar DP 30% ${price(review.preorder_payment?.deposit_amount || 0)}` : selectedMethod === 'PICKUP' ? 'Buat pesanan & lanjut bayar' : 'Buat pesanan langsung'}
          </button>
        </form>
        <aside class="ringkasan">
          <p class="label-kecil">RINGKASAN PEMBAYARAN</p>
          <div class="produk">
            <strong>{review.item.name}</strong>
            <span>{review.item.quantity} × {price(review.item.price)}</span>
          </div>
          {#if review.item.is_pre_order && review.preorder_payment}
            <div class="tempo-pembayaran">
              <div class="label-pembayaran"><span>DP 30%</span><strong>BAYAR SEKARANG</strong></div>
              <strong class="jumlah-pembayaran">{price(review.preorder_payment.deposit_amount)}</strong>
              <p>Kuota pre-order dikunci setelah DP berhasil dibayar melalui Midtrans.</p>
              <p class="catatan-pengembalian">DP tidak dapat dikembalikan jika pre-order dibatalkan.</p>
            </div>
            <div class="baris-sisa">
              <div class="teks-sisa"><strong>Sisa pelunasan</strong><span>Dibayar setelah panen</span></div>
              <strong class="jumlah-sisa">{price(review.preorder_payment.remaining_amount)}</strong>
            </div>
            <div class="total-pesanan"><span>Total pesanan</span><strong>{price(review.total_pembayaran)}</strong></div>
          {:else}
            <div class="total"><span>Total</span><strong>{price(review.total_pembayaran)}</strong></div>
            <p class="catatan">{selectedMethod === 'PICKUP' ? 'Setelah pesanan dibuat, pembayaran dilakukan melalui Midtrans pada tab baru.' : 'Pesanan langsung dianggap selesai. Detail kontak petani tersedia di halaman order.'}</p>
          {/if}
        </aside>
      </div>
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
		max-width: 1000px;
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
	.tata-bayar {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 20px;
	}
	.kartu-formulir,.ringkasan {
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 24px;
	}
	.kartu-formulir {
		display: grid;
		gap: 25px;
	}
	.bagian-formulir {
		display: grid;
		gap: 15px;
	}
	.bagian-formulir>.label-kecil {
		border-bottom: 1px solid #e8eee6;
		padding-bottom: 12px;
		margin: 0;
	}
	label {
		display: grid;
		gap: 7px;
		color: #385540;
		font-size: 12px;
		font-weight: 700;
	}
	input:not([type=radio]) {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fbfdfb;
		padding: 12px;
		font: inherit;
		color: #183126;
		outline: 0;
	}
	input:focus {
		border-color: #39754b;
		box-shadow: 0 0 0 3px #39754b1c;
	}
	.kisi-metode {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.kisi-metode label {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 5px 8px;
		padding: 15px;
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		cursor: pointer;
	}
	.kisi-metode label.terpilih {
		border-color: #39754b;
		background: #f4faf2;
		box-shadow: inset 0 0 0 1px #39754b;
	}
	.kisi-metode span {
		grid-column: 2;
		color: #718077;
		font-size: 11px;
		font-weight: 400;
		line-height: 1.45;
	}
	.kirim {
		border: 0;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 14px;
		font: 700 13px 'DM Sans',sans-serif;
		cursor: pointer;
	}
	.kirim:disabled {
		opacity: .6;
	}
	.ringkasan {
		height: max-content;
	}
	.produk {
		display: flex;
		justify-content: space-between;
		gap: 15px;
		padding: 18px 0;
		border-top: 1px solid #e8eee6;
		border-bottom: 1px solid #e8eee6;
	}
	.produk strong {
		font-size: 15px;
	}
	.produk span {
		color: #718077;
		font-size: 12px;
	}
	.total {
		display: flex;
		justify-content: space-between;
		padding-top: 15px;
	}
	.total span {
		color: #718077;
		font-size: 12px;
	}
	.total strong {
		color: #39754b;
		font-size: 16px;
	}
	.catatan {
		color: #718077;
		font-size: 11px;
		line-height: 1.5;
	}
	.peringatan,.keadaan {
		padding: 14px;
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #fff;
	}
	.peringatan.galat,.keadaan.galat {
		color: #a44242;
		background: #fff0ef;
	}
	.keadaan {
		text-align: center;
		color: #718077;
	}
	@media (max-width:700px) {
		.tata-bayar {
			grid-template-columns: 1fr;
		}
		.kisi-metode {
			grid-template-columns: 1fr;
		}
	}
	.tata-bayar {
		grid-template-columns: minmax(0, 1fr) minmax(320px, 360px);
	}
	.tempo-pembayaran {
		margin-top: 18px;
		padding: 16px;
		border-left: 4px solid #39754b;
		background: #f0f7ee;
	}
	.label-pembayaran {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		color: #385540;
	}
	.label-pembayaran span {
		font-size: 13px;
		font-weight: 800;
	}
	.label-pembayaran strong {
		color: #39754b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: .06em;
	}
	.jumlah-pembayaran {
		display: block;
		margin-top: 10px;
		color: #183126;
		font-size: 28px;
		line-height: 1.1;
	}
	.tempo-pembayaran p {
		margin: 8px 0 0;
		color: #5b6e62;
		font-size: 12px;
		line-height: 1.45;
	}
	.baris-sisa {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 15px 0;
		border-bottom: 1px solid #e8eee6;
	}
	.teks-sisa {
		display: grid;
		gap: 4px;
	}
	.teks-sisa strong {
		color: #294b34;
		font-size: 14px;
	}
	.teks-sisa span {
		color: #718077;
		font-size: 12px;
	}
	.jumlah-sisa {
		color: #294b34;
		font-size: 19px;
		white-space: nowrap;
	}
	.catatan-pengembalian {
		padding-top: 8px;
		border-top: 1px solid #dce8da;
		color: #8b542d !important;
		font-weight: 600;
	}
	.total-pesanan {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 12px;
		color: #718077;
		font-size: 14px;
	}
	.total-pesanan strong {
		color: #52685a;
		font-size: 14px;
		font-weight: 600;
	}
	@media (max-width: 820px) {
		.tata-bayar {
			grid-template-columns: 1fr;
		}
	}
	.kisi-metode label.tidak {
		border-color: #e3e6e2;
		background: #eff1ee;
		color: #929992;
		cursor: not-allowed;
		box-shadow: none;
		opacity: .48;
		filter: grayscale(1);
	}
	.kisi-metode label.tidak strong, .kisi-metode label.tidak span {
		color: #858c86;
	}
	.kisi-metode label.tidak input {
		accent-color: #aeb6ae;
		cursor: not-allowed;
	}
	.kisi-metode label.tidak:hover {
		border-color: #e3e6e2;
		background: #eff1ee;
	}
	.catatan-ambil-pra-pesan {
		margin: -3px 0 0;
		color: #65766b;
		font-size: 12px;
		line-height: 1.5;
	}
</style>
