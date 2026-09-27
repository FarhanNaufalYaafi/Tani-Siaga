<script lang="ts">
	import type { Product } from '$lib/api/product-api';

	let {
		product,
		shopName,
		shopLocation,
		showPopularity = false,
		actionLabel,
		actionHref,
	}: {
		product: Product;
		shopName?: string;
		shopLocation?: string;
		showPopularity?: boolean;
		actionLabel?: string;
		actionHref?: string;
	} = $props();

	function formatPrice(value: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0,
		}).format(value);
	}

	let resolvedShopName = $derived(shopName || product.shop?.name || 'Toko petani');
	let resolvedShopLocation = $derived(shopLocation || product.shop?.location || '');
	let resolvedActionHref = $derived(actionHref || `/e-commerce/${product.id}`);
	let harvestByKg = $derived(product.is_pre_order || Boolean(product.farmland_id));
	let availability = $derived(
		product.is_pre_order
			? `Kuota ${Math.max(0, product.po_quota_kg - product.po_booked_kg)} kg`
			: `${Math.max(0, product.stock - product.po_booked_kg)} ${harvestByKg ? 'kg tersedia' : 'unit tersedia'}`,
	);
</script>

<article class="product-card">
	<a class="image-wrap" href={resolvedActionHref}>
		{#if product.image_url?.[0]}
			<img src={product.image_url[0]} alt={product.name} />
		{:else}
			<span class="placeholder">🌾</span>
		{/if}
		<span class:po={product.is_pre_order} class="tag">
			{product.is_pre_order ? 'PRE-ORDER' : 'SIAP DIKIRIM'}
		</span>
		{#if showPopularity}
			<span class="popular">PALING DIMINATI</span>
		{/if}
	</a>
	<div class="product-body">
		<a class="product-name" href={resolvedActionHref}>
			<h2>{product.name}</h2>
		</a>
		<div class="product-bottom">
			<strong>{formatPrice(product.price)}</strong>
			<span>{availability}</span>
		</div>
		<p class="seller">{resolvedShopName}</p>
		{#if resolvedShopLocation}
			<p class="shop-location">⌖ {resolvedShopLocation}</p>
		{/if}
		<p class="description">{product.description}</p>
		{#if actionLabel}
			<a class="detail-button" href={resolvedActionHref}>{actionLabel}</a>
		{/if}
	</div>
</article>

<style>
	.product-card {
		overflow: hidden;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e0a;
		transition: transform .2s, box-shadow .2s;
	}

	.product-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 14px 30px #23472e18;
	}

	.image-wrap {
		position: relative;
		display: grid;
		place-items: center;
		height: 190px;
		overflow: hidden;
		background: #dcebd8;
		text-decoration: none;
	}

	.image-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder {
		font-size: 55px;
	}

	.tag,
	.popular {
		position: absolute;
		top: 12px;
		border-radius: 5px;
		color: #fff;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: .08em;
		padding: 6px 8px;
	}

	.tag {
		left: 12px;
		background: #183126;
	}

	.tag.po {
		background: #a8762e;
	}

	.popular {
		right: 12px;
		background: #39754b;
	}

	.product-body {
		display: grid;
		gap: 9px;
		padding: 16px;
	}

	.product-name {
		color: #183126;
		text-decoration: none;
	}

	.product-name h2 {
		margin: 0 0 8px;
		font-size: 18px;
	}

	.product-bottom {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 8px;
	}

	.product-bottom strong {
		color: #39754b;
		font-size: 15px;
	}

	.product-bottom span {
		color: #718077;
		font-size: 10px;
		text-align: right;
	}

	.seller {
		margin: 2px 0 0;
		color: #718077;
		font-size: 10px;
		letter-spacing: .08em;
		text-transform: uppercase;
	}

	.shop-location {
		margin: -4px 0 0;
		color: #52705a;
		font-size: 11px;
		line-height: 1.4;
	}

	.description {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		margin: 0;
		color: #718077;
		font-size: 12px;
		line-height: 1.45;
	}

	.detail-button {
		display: block;
		border: 1px solid #a9c9aa;
		border-radius: 6px;
		background: #f4faf2;
		color: #39754b;
		padding: 9px;
		font-size: 11px;
		font-weight: 700;
		text-align: center;
		text-decoration: none;
	}

	.detail-button:hover {
		background: #e0f0dd;
	}

	@media (max-width: 480px) {
		.image-wrap { height: 112px; }
		.tag, .popular { top: 7px; padding: 5px 6px; font-size: 8px; }
		.tag { left: 7px; }
		.popular { right: 7px; }
		.product-body { gap: 7px; padding: 11px; }
		.product-name h2 { margin-bottom: 4px; font-size: 14px; line-height: 1.3; overflow-wrap: anywhere; }
		.product-bottom { align-items: flex-start; flex-direction: column; gap: 3px; }
		.product-bottom strong { font-size: 14px; }
		.product-bottom span { text-align: left; }
		.seller { font-size: 9px; letter-spacing: .04em; }
		.shop-location, .description { font-size: 10px; }
		.detail-button { padding: 8px 6px; font-size: 10px; }
	}
</style>
