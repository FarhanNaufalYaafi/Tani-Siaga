<script lang="ts">
	import type { Product } from '$lib/api/product-api';

	let {
		product,
		shopName,
		shopLocation,
		showPopularity = false,
		actionLabel,
		actionHref,
		linkEnabled = true,
		statusLabel,
		statusTone = 'pending',
	}: {
		product: Product;
		shopName?: string;
		shopLocation?: string;
		showPopularity?: boolean;
		actionLabel?: string;
		actionHref?: string;
		linkEnabled?: boolean;
		statusLabel?: string;
		statusTone?: 'pending' | 'approved' | 'rejected' | 'disabled' | 'deleted';
	} = $props();

	function formatPrice(value: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function formatSoldCount(value?: number | null) {
		const total = Number(value ?? 0);
		if (!Number.isFinite(total) || total <= 0) return '0 terjual';
		if (total < 1000) return `${total} terjual`;
		if (total < 10000) return `${Math.floor(total / 1000) * 1000}+ terjual`;
		if (total < 1000000) return `${Math.floor(total / 1000) * 1000}+ terjual`;
		return `${Math.floor(total / 1000000)}jt+ terjual`;
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

<article class="kartu-produk">
	<a class="bungkus-gambar" href={linkEnabled ? resolvedActionHref : undefined}>
		{#if product.image_url?.[0]}
			<img src={product.image_url[0]} alt={product.name} />
		{:else}
			<span class="contoh">🌾</span>
		{/if}
		{#if showPopularity}
			<span class="populer">PALING DIMINATI</span>
		{/if}
		{#if statusLabel}
			<span class="status-moderasi" class:disetujui={statusTone === 'approved'} class:ditolak={statusTone === 'rejected' || statusTone === 'deleted'} class:nonaktif={statusTone === 'disabled'}>{statusLabel}</span>
		{/if}
	</a>
	<div class="isi-produk">
		<a class="nama-produk" href={linkEnabled ? resolvedActionHref : undefined}>
			<h2>{product.name}</h2>
		</a>
		<div class="ringkasan-penilaian" aria-label={product.rating_count ? `Rating ${product.rating_average} dari 5 dari ${product.rating_count} ulasan` : 'Belum ada rating'}>
			<span class="bintang-penilaian">{product.rating_count ? '★'.repeat(Math.round(product.rating_average || 0)) : '☆☆☆☆☆'}</span>
			<span>{product.rating_count ? `${Number(product.rating_average).toFixed(1)} (${product.rating_count})` : 'Belum ada rating'}</span>
		</div>
		<div class="bawah-produk">
			<strong>{formatPrice(product.price)}</strong>
			<span>{availability}</span>
		</div>
		<p class="informasi-terjual">{formatSoldCount(product.sold_quantity)}</p>
		<p class="penjual">{resolvedShopName}</p>
		{#if resolvedShopLocation}
			<p class="lokasi-toko">⌖ {resolvedShopLocation}</p>
		{/if}
		<div class:pra-pesan={product.is_pre_order} class="unggulan-ketersediaan">
			{product.is_pre_order ? 'PRE-ORDER HASIL PANEN' : 'SIAP DIKIRIM'}
		</div>
		{#if actionLabel}
			<a class="tombol-rincian" href={resolvedActionHref}>{actionLabel}</a>
		{/if}
	</div>
</article>

<style>
	.kartu-produk {
		overflow: hidden;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e0a;
		transition: transform .2s, box-shadow .2s;
	}
	.kartu-produk:hover {
		transform: translateY(-4px);
		box-shadow: 0 14px 30px #23472e18;
	}
	.bungkus-gambar {
		position: relative;
		display: grid;
		place-items: center;
		height: 190px;
		overflow: hidden;
		background: #dcebd8;
		text-decoration: none;
	}
	.bungkus-gambar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.contoh {
		font-size: 55px;
	}
	.populer {
		position: absolute;
		top: 12px;
		border-radius: 5px;
		color: #fff;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: .08em;
		padding: 6px 8px;
	}
	.populer {
		right: 12px;
		background: #39754b;
	}
	.status-moderasi {
		position: absolute;
		top: 12px;
		right: 12px;
		border: 1px solid #e6d4a9;
		border-radius: 999px;
		background: #fff8e7;
		color: #946b26;
		padding: 6px 9px;
		font-size: 10px;
		font-weight: 800;
	}
	.status-moderasi.disetujui {
		border-color: #d6e8d5;
		background: #eaf4e9;
		color: #39754b;
	}
	.status-moderasi.ditolak {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	.status-moderasi.nonaktif {
		border-color: #e6d4a9;
		background: #fff8e7;
		color: #946b26;
	}
	.isi-produk {
		display: grid;
		gap: 9px;
		padding: 16px;
	}
	.nama-produk {
		color: #183126;
		text-decoration: none;
	}
	.nama-produk h2 {
		margin: 0 0 8px;
		font-size: 18px;
	}
	.ringkasan-penilaian {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #718077;
		font-size: 10px;
	}
	.bintang-penilaian {
		color: #d49a24;
		font-size: 13px;
		letter-spacing: .04em;
	}
	.bawah-produk {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 8px;
	}
	.bawah-produk strong {
		color: #39754b;
		font-size: 15px;
	}
	.bawah-produk span {
		color: #718077;
		font-size: 10px;
		text-align: right;
	}
	.informasi-terjual {
		margin: 0;
		color: #39754b;
		font-size: 11px;
		font-weight: 700;
	}
	.penjual {
		margin: 2px 0 0;
		color: #718077;
		font-size: 10px;
		letter-spacing: .08em;
		text-transform: uppercase;
	}
	.lokasi-toko {
		margin: -4px 0 0;
		color: #52705a;
		font-size: 11px;
		line-height: 1.4;
	}
	.unggulan-ketersediaan {
		border: 1px solid #cee2cf;
		border-radius: 6px;
		background: #edf8ed;
		color: #39754b;
		padding: 8px 9px;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: .07em;
		text-align: center;
	}
	.unggulan-ketersediaan.pra-pesan {
		border-color: #e6d4a9;
		background: #fff8e7;
		color: #946b26;
	}
	.tombol-rincian {
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
	.tombol-rincian:hover {
		background: #e0f0dd;
	}
	@media (max-width: 480px) {
		.bungkus-gambar {
			height: 112px;
		}
		.populer {
			top: 7px;
			padding: 5px 6px;
			font-size: 8px;
		}
		.populer {
			right: 7px;
		}
		.isi-produk {
			gap: 7px;
			padding: 11px;
		}
		.nama-produk h2 {
			margin-bottom: 4px;
			font-size: 14px;
			line-height: 1.3;
			overflow-wrap: anywhere;
		}
		.bawah-produk {
			align-items: flex-start;
			flex-direction: column;
			gap: 3px;
		}
		.bawah-produk strong {
			font-size: 14px;
		}
		.bawah-produk span {
			text-align: left;
		}
		.penjual {
			font-size: 9px;
			letter-spacing: .04em;
		}
		.lokasi-toko {
			font-size: 10px;
		}
		.tombol-rincian {
			padding: 8px 6px;
			font-size: 10px;
		}
	}
</style>
