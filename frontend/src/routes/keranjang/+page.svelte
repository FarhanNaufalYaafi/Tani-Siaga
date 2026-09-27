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
<div class="page-shell">
  <div class="page-container">
    <a class="back" href="/e-commerce">← Kembali ke katalog</a>
    <div class="heading">
      <div><p class="eyebrow">BELANJA</p><h1>Keranjang kamu</h1><p class="subtitle">Periksa produk sebelum melanjutkan ke pembayaran.</p></div>
      <a class="orders-link" href="/pesanan">Status & riwayat pesanan →</a>
    </div>
    {#if actionError}<p class="action-error" role="alert">{actionError}</p>{/if}
    {#if isLoading}
      <div class="state">Memuat keranjang...</div>
    {:else if errorMessage}
      <div class="state error">{errorMessage}<a href="/signin">Masuk ke akun</a></div>
    {:else if cart && cart.cartItems.length === 0}
      <div class="state">Keranjang masih kosong.<a href="/e-commerce">Cari produk</a></div>
    {:else if cart}
      <div class="cart-layout">
        <section class="items">
          {#each cart.cartItems as item (item.id)}
            <article class="item">
              <a class="product-thumbnail" href={`/e-commerce/${item.product.id}`} aria-label={`Lihat ${item.product.name}`}><div class="thumb">{#if item.product.image_url?.[0]}<img src={item.product.image_url[0]} alt={item.product.name} />{:else}🌾{/if}</div></a>
              <div class="item-info"><p>{item.product.shop?.name || 'Nama toko tidak tersedia'}</p><h2><a class="product-name-link" href={`/e-commerce/${item.product.id}`}>{item.product.name}</a></h2><span>{price(item.product.price)} / {item.product.is_pre_order || item.product.farmland_id ? 'kg' : 'unit'}</span></div>
              <div class="item-total"><span>Harga total</span><strong>{price(item.total_price)}</strong></div>
              <div class="cart-quantity">
                <span>Jumlah</span>
                <div class="quantity-control">
                  <button type="button" aria-label={`Kurangi jumlah ${item.product.name}`} onclick={() => adjustQuantity(item, -1)} disabled={item.quantity <= 1 || updatingId === item.id}>−</button>
                  <input type="number" min="1" max={Math.max(maximumQuantity(item), item.quantity)} step="1" aria-label={`Jumlah ${item.product.name}`} value={quantityDrafts[item.id] ?? item.quantity} oninput={(event) => setQuantityDraft(item.id, event.currentTarget.value)} onblur={(event) => handleQuantityBlur(event, item)} disabled={maximumQuantity(item) < 1 || updatingId === item.id} />
                  <button type="button" aria-label={`Tambah jumlah ${item.product.name}`} onclick={() => adjustQuantity(item, 1)} disabled={Number(quantityDrafts[item.id] ?? item.quantity) >= maximumQuantity(item) || updatingId === item.id}>+</button>
                </div>
                <small>{updatingId === item.id ? 'Menyimpan...' : maximumQuantity(item) < 1 ? 'Stok habis · hapus item dari keranjang' : `${item.product.is_pre_order || item.product.farmland_id ? 'kg' : 'unit'} · tersedia ${maximumQuantity(item)}`}</small>
              </div>
              <div class="item-actions">
                <a class="checkout-button" href={`/checkout/${item.id}`} onclick={(event) => checkout(event, item)}>Checkout</a>
                <button class="remove" type="button" onclick={() => remove(item.id)} disabled={removingId === item.id || updatingId === item.id}>Hapus</button>
              </div>
            </article>
          {/each}
        </section>
        <aside class="summary">
          <p class="eyebrow">RINGKASAN</p>
          <div><span>Total sementara</span><strong>{price(total)}</strong></div>
          <p>Checkout dilakukan untuk satu produk melalui sistem pembayaran Tani Siaga.</p>
          <button type="button" onclick={() => goto('/e-commerce')}>Lanjut belanja</button>
        </aside>
      </div>
    {/if}
  </div>
</div>
<style>
  .page-shell{min-height:100vh;background:#f5f7f0;color:#183126;padding:38px 20px 70px}.page-container{max-width:1000px;margin:auto}.back{display:inline-block;margin-bottom:28px;color:#39754b;font-size:13px;font-weight:700;text-decoration:none}.heading{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:30px}.orders-link{border-radius:7px;background:#183126;color:#fff;padding:11px 14px;font-size:12px;font-weight:700;text-decoration:none}.eyebrow{margin:0 0 9px;color:#4e805a;font-size:11px;font-weight:800;letter-spacing:.15em}.heading h1{margin:0;font:600 clamp(40px,6vw,65px)/1 'Fraunces',Georgia,serif}.subtitle{color:#718077}.cart-layout{display:grid;grid-template-columns:1fr 300px;gap:20px}.items,.summary{border:1px solid #d6e1d5;border-radius:10px;background:#fff;padding:20px}.item{display:grid;grid-template-columns:72px 1fr auto;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid #e8eee6}.item:last-child{border-bottom:0}.thumb{display:grid;place-items:center;width:72px;height:72px;overflow:hidden;border-radius:7px;background:#dcebd8;font-size:28px}.thumb img{width:100%;height:100%;object-fit:cover}.item-info p{margin:0 0 5px;color:#718077;font-size:10px;text-transform:uppercase}.item-info h2{margin:0 0 6px;font-size:17px}.item-info span{color:#718077;font-size:12px}.checkout-button{grid-column:2;justify-self:start;border-radius:6px;background:#eaf4e9;color:#39754b;padding:8px 10px;font-size:11px;font-weight:800;text-decoration:none}.remove{grid-column:3;border:0;background:none;color:#a44242;font-size:11px;text-align:right;cursor:pointer}.summary{height:max-content}.summary>div{display:flex;justify-content:space-between;gap:10px;padding:18px 0;border-top:1px solid #e8eee6;border-bottom:1px solid #e8eee6}.summary>div span{color:#718077;font-size:12px}.summary strong{color:#39754b}.summary p:not(.eyebrow){color:#718077;font-size:11px;line-height:1.5}.summary button{width:100%;border:0;border-radius:7px;background:#39754b;color:#fff;padding:12px;font:700 12px 'DM Sans',sans-serif;cursor:pointer}.state{padding:40px;text-align:center;border:1px solid #d6e1d5;border-radius:10px;background:#fff;color:#718077}.state a{display:block;margin-top:12px;color:#39754b;font-weight:700}.state.error{color:#a44242;background:#fff0ef}@media(max-width:700px){.heading{display:block}.orders-link{display:inline-block;margin-top:18px}.cart-layout{grid-template-columns:1fr}.item{grid-template-columns:58px 1fr}.thumb{width:58px;height:58px}.checkout-button,.remove{grid-column:2;justify-self:start}.remove{text-align:left}}
  .item { grid-template-columns: 72px minmax(0, 1fr) auto; grid-template-rows: auto auto; }
  .product-thumbnail { grid-column: 1; grid-row: 1 / 3; display: block; width: 72px; height: 72px; text-decoration: none; }
  .thumb { grid-column: auto; grid-row: auto; width: 100%; height: 100%; }
  .item-info { grid-column: 2; grid-row: 1; min-width: 0; }
  .product-name-link { color: inherit; text-decoration: none; }
  .product-name-link:hover { color: #39754b; }
  .item-total { grid-column: 3; grid-row: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 168px; }
  .item-total span { color: #718077; font-size: 11px; }
  .item-total strong { color: #39754b; font-size: 13px; white-space: nowrap; }
  .cart-quantity { grid-column: 2; grid-row: 2; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
  .cart-quantity > span { color: #718077; font-size: 11px; font-weight: 700; }
  .cart-quantity small { color: #718077; font-size: 10px; }
  .quantity-control { display: grid; grid-template-columns: 36px 62px 36px; height: 38px; overflow: hidden; border: 1px solid #a9c9aa; border-radius: 7px; background: #fff; }
  .quantity-control button { display: grid; place-items: center; border: 0; background: #f3f8f1; color: #39754b; font: 700 18px 'DM Sans', sans-serif; cursor: pointer; }
  .quantity-control button:hover:not(:disabled) { background: #dcebd8; }
  .quantity-control button:disabled { color: #9aaa9c; cursor: not-allowed; }
  .quantity-control input { width: 100%; min-width: 0; box-sizing: border-box; border: 0; border-right: 1px solid #d6e1d5; border-left: 1px solid #d6e1d5; border-radius: 0; background: #fff; color: #183126; padding: 0 5px; font: 700 13px 'DM Sans', sans-serif; text-align: center; appearance: textfield; }
  .quantity-control input::-webkit-inner-spin-button, .quantity-control input::-webkit-outer-spin-button { margin: 0; appearance: none; }
  .quantity-control input:focus { outline: 2px solid #39754b; outline-offset: -2px; }
  .item-actions { grid-column: 3; grid-row: 2; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
  .item-actions .checkout-button, .item-actions .remove { grid-column: auto; justify-self: auto; }
  .item-actions .remove { padding: 8px; }
  .action-error { margin: 0 0 14px; border: 1px solid #e6b8b3; border-radius: 7px; background: #fff0ef; color: #a44242; padding: 10px 12px; font-size: 12px; }
  @media (max-width: 700px) {
    .item { grid-template-columns: 58px minmax(0, 1fr); grid-template-rows: auto auto auto; }
    .product-thumbnail { grid-column: 1; grid-row: 1 / 4; width: 58px; height: 58px; }
    .product-thumbnail .thumb { grid-column: auto; grid-row: auto; width: 100%; height: 100%; }
    .item-info { grid-column: 2; grid-row: 1; }
    .item-total { grid-column: 2; grid-row: 2; justify-self: stretch; min-width: 0; }
    .cart-quantity { grid-column: 2; grid-row: 3; }
    .item-actions { grid-column: 2; grid-row: 4; justify-content: flex-start; }
  }
</style>
