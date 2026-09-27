<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getPublicShop, type PublicShopResponse } from '$lib/api/shop-api';
	import Card from '$lib/components/Card.svelte';

	let data = $state<PublicShopResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');

	onMount(async () => {
		try {
			const shopId = page.params.idToko;
			if (!shopId) throw new Error('Toko tidak ditemukan.');
			data = await getPublicShop(shopId);
		} catch (error: any) {
			errorMessage = error.message || 'Gagal memuat detail toko.';
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

	function date(value: string) {
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(value));
	}
</script>

<svelte:head>
	<title>{data ? `${data.shop.name} | Tani Siaga` : 'Detail Toko'}</title>
</svelte:head>

<div class="shop-page">
	<div class="shop-container">
		<a class="back-link" href="/e-commerce">← Kembali ke katalog</a>
		{#if isLoading}
			<div class="state">Memuat detail toko...</div>
		{:else if errorMessage}
			<div class="state error">{errorMessage}</div>
		{:else if data}
			<header class="shop-hero">
				<div class="hero-copy">
					<p class="eyebrow">TOKO PUBLIK</p>
					<h1>{data.shop.name}</h1>
					<p class="description">{data.shop.description}</p>
					<div class="location">⌖ {data.shop.location}</div>
				</div>
				<div class="shop-contact">
					<span>Hubungi toko</span>
					<strong>{data.shop.phone_number}</strong>
				</div>
			</header>

			<section class="stat-grid" aria-label="Ringkasan toko">
				<div class="stat-card"><span>Mulai menjual</span><strong>{date(data.shop.created_at)}</strong></div>
				<div class="stat-card"><span>Pesanan selesai</span><strong>{data.stats.completed_orders}</strong></div>
				<div class="stat-card"><span>Produk terjual</span><strong>{data.stats.sold_quantity} unit</strong></div>
			</section>

			<section class="products-section">
				<div class="section-heading">
					<div>
						<p class="eyebrow">ETALASE TOKO</p>
						<h2>Produk paling diminati</h2>
					</div>
					<span>{data.products.length} produk</span>
				</div>

				{#if data.products.length === 0}
					<div class="empty">Toko ini belum memiliki produk aktif.</div>
				{:else}
					<div class="product-grid">
						{#each data.products as product, index (product.id)}
							<Card
								product={product}
								shopName={data.shop.name}
								shopLocation={data.shop.location}
								showPopularity={index === 0}
							/>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</div>
</div>

<style>
	.shop-page {
		min-height: 100vh;
		background: #f5f7f0;
		color: #183126;
		padding: 38px 20px 80px;
	}

	.shop-container {
		max-width: 1120px;
		margin: 0 auto;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 28px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	.shop-hero {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 28px;
		border-radius: 12px;
		background: #183126;
		color: #fff;
		padding: 42px;
	}

	.eyebrow {
		margin: 0 0 12px;
		color: #8ec18d;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .15em;
	}

	.hero-copy h1 {
		margin: 0;
		font: 600 clamp(38px, 6vw, 72px) / 1 'Fraunces', Georgia, serif;
	}

	.description {
		max-width: 650px;
		margin: 18px 0 0;
		color: #d6e1d5;
		line-height: 1.65;
	}

	.location {
		margin-top: 18px;
		color: #f4d69d;
		font-size: 13px;
	}

	.shop-contact {
		display: grid;
		gap: 7px;
		min-width: 190px;
		border-left: 1px solid #54765d;
		padding-left: 22px;
	}

	.shop-contact span {
		color: #a8c7aa;
		font-size: 12px;
	}

	.shop-contact strong {
		font-size: 14px;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		margin: 18px 0 54px;
	}

	.stat-card {
		display: grid;
		gap: 8px;
		border-bottom: 1px solid #d6e1d5;
		padding: 18px 4px;
	}

	.stat-card span,
	.section-heading > span {
		color: #718077;
		font-size: 12px;
	}

	.stat-card strong {
		color: #39754b;
		font: 600 25px 'Fraunces', Georgia, serif;
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 20px;
	}

	.section-heading h2 {
		margin: 0;
		font: 600 34px / 1.1 'Fraunces', Georgia, serif;
	}

	.product-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}

	.state,
	.empty {
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #fff;
		padding: 18px;
		color: #39754b;
		text-align: center;
	}

	.state.error {
		background: #fff0ef;
		color: #a44242;
	}

	@media (max-width: 850px) {
		.shop-hero {
			align-items: start;
			flex-direction: column;
			padding: 30px;
		}

		.shop-contact {
			border-top: 1px solid #54765d;
			border-left: 0;
			padding: 18px 0 0;
		}

		.product-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 520px) {
		.shop-page {
			padding: 24px 14px 60px;
		}

		.shop-hero {
			padding: 24px;
		}

		.stat-grid,
		.product-grid {
			grid-template-columns: 1fr;
		}
	}
</style>