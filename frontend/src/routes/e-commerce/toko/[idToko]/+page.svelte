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

<div class="halaman-toko">
	<div class="wadah-toko">
		<a class="tautan-kembali" href="/e-commerce">← Kembali ke katalog</a>
		{#if isLoading}
			<div class="keadaan">Memuat detail toko...</div>
		{:else if errorMessage}
			<div class="keadaan galat">{errorMessage}</div>
		{:else if data}
			<header class="utama-toko">
				<div class="teks-utama">
					<div class="foto-toko">{#if data.shop.profile_image_url}<img src={data.shop.profile_image_url} alt={`Foto profil ${data.shop.name}`} />{:else}<span aria-hidden="true">{data.shop.name.slice(0, 1).toUpperCase()}</span>{/if}</div>
					<p class="label-kecil">TOKO PUBLIK</p>
					<h1 class="judul">{data.shop.name}</h1>
					<p class="deskripsi">{data.shop.description}</p>
					<div class="lokasi">⌖ {data.shop.location}</div>
				</div>
				<div class="kontak-toko">
					<span>Hubungi toko</span>
					<strong>{data.shop.phone_number}</strong>
				</div>
			</header>

			<section class="kisi-statistik" aria-label="Ringkasan toko">
				<div class="kartu-statistik"><span>Mulai menjual</span><strong>{date(data.shop.created_at)}</strong></div>
				<div class="kartu-statistik"><span>Pesanan selesai</span><strong>{data.stats.completed_orders}</strong></div>
				<div class="kartu-statistik"><span>Produk terjual</span><strong>{data.stats.sold_quantity} unit</strong></div>
			</section>

			<section class="bagian-produk">
				<div class="judul-bagian">
					<div>
						<p class="label-kecil">ETALASE TOKO</p>
						<h2>Produk paling diminati</h2>
					</div>
					<span>{data.products.length} produk</span>
				</div>

				{#if data.products.length === 0}
					<div class="kosong">Toko ini belum memiliki produk aktif.</div>
				{:else}
					<div class="kisi-produk">
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
	.halaman-toko {
		min-height: 100vh;
		background: #f5f7f0;
		color: #183126;
		padding: 38px 20px 80px;
	}
	.wadah-toko {
		max-width: 1120px;
		margin: 0 auto;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 28px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.utama-toko {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 28px;
		border-radius: 12px;
		background: #183126;
		color: #fff;
		padding: 42px;
	}
	.label-kecil {
		margin: 0 0 12px;
		color: #8ec18d;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .15em;
	}
	.foto-toko {
		display: grid;
		place-items: center;
		width: 76px;
		height: 76px;
		overflow: hidden;
		margin-bottom: 16px;
		border: 2px solid #8ec18d;
		border-radius: 50%;
		background: #dcebd8;
		color: #39754b;
		font-size: 28px;
		font-weight: 800;
	}
	.foto-toko img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.teks-utama h1 {
		margin: 0;
		font: 600 clamp(38px, 6vw, 72px) / 1 'Fraunces', Georgia, serif;
	}
	.deskripsi {
		max-width: 650px;
		margin: 18px 0 0;
		color: #d6e1d5;
		line-height: 1.65;
	}
	.lokasi {
		margin-top: 18px;
		color: #f4d69d;
		font-size: 13px;
	}
	.kontak-toko {
		display: grid;
		gap: 7px;
		min-width: 190px;
		border-left: 1px solid #54765d;
		padding-left: 22px;
	}
	.kontak-toko span {
		color: #a8c7aa;
		font-size: 12px;
	}
	.kontak-toko strong {
		font-size: 14px;
	}
	.kisi-statistik {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		margin: 18px 0 54px;
	}
	.kartu-statistik {
		display: grid;
		gap: 8px;
		border-bottom: 1px solid #d6e1d5;
		padding: 18px 4px;
	}
	.kartu-statistik span,
			.judul-bagian > span {
		color: #718077;
		font-size: 12px;
	}
	.kartu-statistik strong {
		color: #39754b;
		font: 600 25px 'Fraunces', Georgia, serif;
	}
	.judul-bagian {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 20px;
	}
	.judul-bagian h2 {
		margin: 0;
		font: 600 34px / 1.1 'Fraunces', Georgia, serif;
	}
	.kisi-produk {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}
	.keadaan,
			.kosong {
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #fff;
		padding: 18px;
		color: #39754b;
		text-align: center;
	}
	.keadaan.galat {
		background: #fff0ef;
		color: #a44242;
	}
	@media (max-width: 850px) {
		.utama-toko {
			align-items: start;
			flex-direction: column;
			padding: 30px;
		}
		.kontak-toko {
			border-top: 1px solid #54765d;
			border-left: 0;
			padding: 18px 0 0;
		}
		.kisi-produk {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 520px) {
		.halaman-toko {
			padding: 24px 14px 60px;
		}
		.utama-toko {
			padding: 24px;
		}
		.kisi-statistik,
				.kisi-produk {
			grid-template-columns: 1fr;
		}
	}
</style>