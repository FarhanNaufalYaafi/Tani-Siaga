<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getCart, removeCartItem, updateCartItemQuantity, type Cart, type CartItem } from '$lib/api/product-api';
  let cart = $state<Cart | null>(null);
  let isLoading = $state(true);
  let errorMessage = $state('');
  let actionError = $state('');
  let removingId = $state<number | null>(null);
  let updatingId = $state<number | null>(null);
  let quantityDrafts = $state<Record<number, string>>({});

  onMount(async () => {
    try {
      cart = await getCart();
      quantityDrafts = Object.fromEntries(cart.cartItems.map((item) => [item.id, String(item.quantity)]));
    } catch (error: any) {
      errorMessage = error.message || 'Silakan masuk untuk melihat keranjang.';
    } finally {
      isLoading = false;
    }
  });

  function price(value: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }

  let total = $derived((cart?.cartItems || []).reduce((sum, item) => sum + Number(item.total_price), 0));

  function maximumQuantity(item: CartItem) {
    return item.product.is_pre_order
      ? Math.max(0, item.product.po_quota_kg - item.product.po_booked_kg)
      : Math.max(0, item.product.stock - item.product.po_booked_kg);
  }

  function setQuantityDraft(id: number, value: string) {
    quantityDrafts = { ...quantityDrafts, [id]: value };
  }

  async function saveQuantity(item: CartItem, requested: number | string): Promise<boolean> {
    const quantity = Number(requested);
    const maximum = maximumQuantity(item);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setQuantityDraft(item.id, String(item.quantity));
      actionError = 'Jumlah harus berupa bilangan bulat minimal 1.';
      return false;
    }
    if (quantity > maximum) {
      setQuantityDraft(item.id, String(item.quantity));
      actionError = `Stok ${item.product.name} yang tersedia maksimal ${maximum}.`;
      return false;
    }
    if (quantity === item.quantity) {
      setQuantityDraft(item.id, String(item.quantity));
      return true;
    }

    updatingId = item.id;
    actionError = '';
    try {
      const result = await updateCartItemQuantity(item.id, quantity);
      if (cart) {
        cart = {
          ...cart,
          cartItems: cart.cartItems.map((current) => current.id === item.id
            ? { ...current, quantity: result.data.quantity, total_price: result.data.total_price }
            : current),
        };
      }
      setQuantityDraft(item.id, String(result.data.quantity));
      return true;
    } catch (error: any) {
      setQuantityDraft(item.id, String(item.quantity));
      actionError = error.message || 'Gagal memperbarui jumlah produk.';
      return false;
    } finally {
      updatingId = null;
    }
  }

  async function adjustQuantity(item: CartItem, delta: number) {
    const current = Number(quantityDrafts[item.id] ?? item.quantity);
    const maximum = maximumQuantity(item);
    if (maximum < 1) {
      actionError = `Stok ${item.product.name} sudah habis. Hapus item dari keranjang.`;
      return;
    }
    const next = delta < 0 && current > maximum ? maximum : Math.min(current + delta, maximum);
    await saveQuantity(item, next);
  }

  function handleQuantityBlur(event: FocusEvent, item: CartItem) {
    const nextFocus = event.relatedTarget;
    if (nextFocus instanceof HTMLElement && (nextFocus.closest('.quantity-control') || nextFocus.closest('.item-actions'))) return;
    const draft = quantityDrafts[item.id];
    if (draft !== undefined) void saveQuantity(item, draft);
  }

  async function checkout(event: MouseEvent, item: CartItem) {
    const draft = quantityDrafts[item.id] ?? String(item.quantity);
    if (Number(draft) === item.quantity) return;
    event.preventDefault();
    if (await saveQuantity(item, draft)) await goto(`/checkout/${item.id}`);
  }

  async function remove(id: number) {
    removingId = id;
    actionError = '';
    try {
      await removeCartItem(id);
      if (cart) cart = { ...cart, cartItems: cart.cartItems.filter((item) => item.id !== id) };
      const { [id]: _removed, ...remainingDrafts } = quantityDrafts;
      quantityDrafts = remainingDrafts;
    } catch (error: any) {
      actionError = error.message || 'Gagal menghapus item.';
    } finally {
      removingId = null;
    }
  }
</script>
<svelte:head><title>Keranjang | Tani Siaga</title></svelte:head>
<div class="kerangka-halaman">
  <div class="wadah-halaman">
    <a class="kembali" href="/e-commerce">← Kembali ke katalog</a>
    <div class="judul">
      <div><p class="label-kecil">BELANJA</p><h1 class="judul">Keranjang kamu</h1><p class="subjudul">Periksa produk sebelum melanjutkan ke pembayaran.</p></div>
      <a class="tautan-pesanan" href="/pesanan">Status & riwayat pesanan →</a>
    </div>
    {#if actionError}<p class="galat-aksi" role="alert">{actionError}</p>{/if}
    {#if isLoading}
      <div class="keadaan">Memuat keranjang...</div>
    {:else if errorMessage}
      <div class="keadaan galat">{errorMessage}<a href="/signin">Masuk ke akun</a></div>
    {:else if cart && cart.cartItems.length === 0}
      <div class="keadaan">Keranjang masih kosong.<a href="/e-commerce">Cari produk</a></div>
    {:else if cart}
      <div class="tata-keranjang">
        <section class="daftar-butir-keranjang">
          {#each cart.cartItems as item (item.id)}
            <article class="butir-keranjang">
              <a class="miniatur-produk" href={`/e-commerce/${item.product.id}`} aria-label={`Lihat ${item.product.name}`}><div class="penggeser">{#if item.product.image_url?.[0]}<img src={item.product.image_url[0]} alt={item.product.name} />{:else}🌾{/if}</div></a>
              <div class="informasi-butir"><p>{item.product.shop?.name || 'Nama toko tidak tersedia'}</p><h2><a class="tautan-nama-produk" href={`/e-commerce/${item.product.id}`}>{item.product.name}</a></h2><span>{price(item.product.price)} / {item.product.is_pre_order || item.product.farmland_id ? 'kg' : 'unit'}</span></div>
              <div class="total-butir"><span>Harga total</span><strong>{price(item.total_price)}</strong></div>
              <div class="jumlah-keranjang">
                <span>Jumlah</span>
                <div class="kontrol-jumlah">
                  <button type="button" aria-label={`Kurangi jumlah ${item.product.name}`} onclick={() => adjustQuantity(item, -1)} disabled={item.quantity <= 1 || updatingId === item.id}>−</button>
                  <input type="number" min="1" max={Math.max(maximumQuantity(item), item.quantity)} step="1" aria-label={`Jumlah ${item.product.name}`} value={quantityDrafts[item.id] ?? item.quantity} oninput={(event) => setQuantityDraft(item.id, event.currentTarget.value)} onblur={(event) => handleQuantityBlur(event, item)} disabled={maximumQuantity(item) < 1 || updatingId === item.id} />
                  <button type="button" aria-label={`Tambah jumlah ${item.product.name}`} onclick={() => adjustQuantity(item, 1)} disabled={Number(quantityDrafts[item.id] ?? item.quantity) >= maximumQuantity(item) || updatingId === item.id}>+</button>
                </div>
                <small>{updatingId === item.id ? 'Menyimpan...' : maximumQuantity(item) < 1 ? 'Stok habis · hapus item dari keranjang' : `${item.product.is_pre_order || item.product.farmland_id ? 'kg' : 'unit'} · tersedia ${maximumQuantity(item)}`}</small>
              </div>
              <div class="aksi-butir">
                <a class="tombol-bayar" href={`/checkout/${item.id}`} onclick={(event) => checkout(event, item)}>Checkout</a>
                <button class="hapus" type="button" onclick={() => remove(item.id)} disabled={removingId === item.id || updatingId === item.id}>Hapus</button>
              </div>
            </article>
          {/each}
        </section>
        <aside class="ringkasan">
          <p class="label-kecil">RINGKASAN</p>
          <div><span>Total sementara</span><strong>{price(total)}</strong></div>
          <p>Checkout dilakukan untuk satu produk melalui sistem pembayaran Tani Siaga.</p>
          <button type="button" onclick={() => goto('/e-commerce')}>Lanjut belanja</button>
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
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 18px;
		margin-bottom: 30px;
	}
	.tautan-pesanan {
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
	.tata-keranjang {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 20px;
	}
	.daftar-butir-keranjang,.ringkasan {
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 20px;
	}
	.butir-keranjang {
		display: grid;
		grid-template-columns: 72px 1fr auto;
		gap: 14px;
		align-items: center;
		padding: 14px 0;
		border-bottom: 1px solid #e8eee6;
	}
	.butir-keranjang:last-child {
		border-bottom: 0;
	}
	.penggeser {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		overflow: hidden;
		border-radius: 7px;
		background: #dcebd8;
		font-size: 28px;
	}
	.penggeser img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.informasi-butir p {
		margin: 0 0 5px;
		color: #718077;
		font-size: 10px;
		text-transform: uppercase;
	}
	.informasi-butir h2 {
		margin: 0 0 6px;
		font-size: 17px;
	}
	.informasi-butir span {
		color: #718077;
		font-size: 12px;
	}
	.tombol-bayar {
		grid-column: 2;
		justify-self: start;
		border-radius: 6px;
		background: #eaf4e9;
		color: #39754b;
		padding: 8px 10px;
		font-size: 11px;
		font-weight: 800;
		text-decoration: none;
	}
	.hapus {
		grid-column: 3;
		border: 0;
		background: none;
		color: #a44242;
		font-size: 11px;
		text-align: right;
		cursor: pointer;
	}
	.ringkasan {
		height: max-content;
	}
	.ringkasan>div {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 18px 0;
		border-top: 1px solid #e8eee6;
		border-bottom: 1px solid #e8eee6;
	}
	.ringkasan>div span {
		color: #718077;
		font-size: 12px;
	}
	.ringkasan strong {
		color: #39754b;
	}
	.ringkasan p:not(.label-kecil) {
		color: #718077;
		font-size: 11px;
		line-height: 1.5;
	}
	.ringkasan button {
		width: 100%;
		border: 0;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 12px;
		font: 700 12px 'DM Sans',sans-serif;
		cursor: pointer;
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
	@media (max-width:700px) {
		.judul {
			display: block;
		}
		.tautan-pesanan {
			display: inline-block;
			margin-top: 18px;
		}
		.tata-keranjang {
			grid-template-columns: 1fr;
		}
		.butir-keranjang {
			grid-template-columns: 58px 1fr;
		}
		.penggeser {
			width: 58px;
			height: 58px;
		}
		.tombol-bayar,.hapus {
			grid-column: 2;
			justify-self: start;
		}
		.hapus {
			text-align: left;
		}
	}
	.butir-keranjang {
		grid-template-columns: 72px minmax(0, 1fr) auto;
		grid-template-rows: auto auto;
	}
	.miniatur-produk {
		grid-column: 1;
		grid-row: 1 / 3;
		display: block;
		width: 72px;
		height: 72px;
		text-decoration: none;
	}
	.penggeser {
		grid-column: auto;
		grid-row: auto;
		width: 100%;
		height: 100%;
	}
	.informasi-butir {
		grid-column: 2;
		grid-row: 1;
		min-width: 0;
	}
	.tautan-nama-produk {
		color: inherit;
		text-decoration: none;
	}
	.tautan-nama-produk:hover {
		color: #39754b;
	}
	.total-butir {
		grid-column: 3;
		grid-row: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-width: 168px;
	}
	.total-butir span {
		color: #718077;
		font-size: 11px;
	}
	.total-butir strong {
		color: #39754b;
		font-size: 13px;
		white-space: nowrap;
	}
	.jumlah-keranjang {
		grid-column: 2;
		grid-row: 2;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		min-width: 0;
	}
	.jumlah-keranjang > span {
		color: #718077;
		font-size: 11px;
		font-weight: 700;
	}
	.jumlah-keranjang small {
		color: #718077;
		font-size: 10px;
	}
	.kontrol-jumlah {
		display: grid;
		grid-template-columns: 36px 62px 36px;
		height: 38px;
		overflow: hidden;
		border: 1px solid #a9c9aa;
		border-radius: 7px;
		background: #fff;
	}
	.kontrol-jumlah button {
		display: grid;
		place-items: center;
		border: 0;
		background: #f3f8f1;
		color: #39754b;
		font: 700 18px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.kontrol-jumlah button:hover:not(:disabled) {
		background: #dcebd8;
	}
	.kontrol-jumlah button:disabled {
		color: #9aaa9c;
		cursor: not-allowed;
	}
	.kontrol-jumlah input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		border: 0;
		border-right: 1px solid #d6e1d5;
		border-left: 1px solid #d6e1d5;
		border-radius: 0;
		background: #fff;
		color: #183126;
		padding: 0 5px;
		font: 700 13px 'DM Sans', sans-serif;
		text-align: center;
		appearance: textfield;
	}
	.kontrol-jumlah input::-webkit-inner-spin-button, .kontrol-jumlah input::-webkit-outer-spin-button {
		margin: 0;
		appearance: none;
	}
	.kontrol-jumlah input:focus {
		outline: 2px solid #39754b;
		outline-offset: -2px;
	}
	.aksi-butir {
		grid-column: 3;
		grid-row: 2;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}
	.aksi-butir .tombol-bayar, .aksi-butir .hapus {
		grid-column: auto;
		justify-self: auto;
	}
	.aksi-butir .hapus {
		padding: 8px;
	}
	.galat-aksi {
		margin: 0 0 14px;
		border: 1px solid #e6b8b3;
		border-radius: 7px;
		background: #fff0ef;
		color: #a44242;
		padding: 10px 12px;
		font-size: 12px;
	}
	@media (max-width: 700px) {
		.butir-keranjang {
			grid-template-columns: 58px minmax(0, 1fr);
			grid-template-rows: auto auto auto;
		}
		.miniatur-produk {
			grid-column: 1;
			grid-row: 1 / 4;
			width: 58px;
			height: 58px;
		}
		.miniatur-produk .penggeser {
			grid-column: auto;
			grid-row: auto;
			width: 100%;
			height: 100%;
		}
		.informasi-butir {
			grid-column: 2;
			grid-row: 1;
		}
		.total-butir {
			grid-column: 2;
			grid-row: 2;
			justify-self: stretch;
			min-width: 0;
		}
		.jumlah-keranjang {
			grid-column: 2;
			grid-row: 3;
		}
		.aksi-butir {
			grid-column: 2;
			grid-row: 4;
			justify-content: flex-start;
		}
	}
</style>
