<script lang="ts">
	import { onMount } from 'svelte';
	import { getCurrentUser } from '$lib/api/auth-api';
	import { getPendingProductApprovals, getPendingShopApprovals } from '$lib/api/admin-api';

	let loading = $state(true);
	let errorMessage = $state('');
	let shopCount = $state(0);
	let productCount = $state(0);
	let adminLabel = $state('Admin');

	onMount(async () => {
		try {
			const user = await getCurrentUser();
			if (user.role !== 'admin') {
				errorMessage = 'Akses ditolak. Hanya admin yang dapat membuka dashboard ini.';
				return;
			}
			adminLabel = 'Admin';
			const [shopsResult, productsResult] = await Promise.all([
				getPendingShopApprovals(1, 1),
				getPendingProductApprovals(1, 1),
			]);
			shopCount = shopsResult.meta.total;
			productCount = productsResult.meta.total;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memuat dashboard admin.';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Dashboard Admin | Tani Siaga</title>
</svelte:head>

<div class="kerangka-halaman">
	{#if loading}
		<div class="keadaan">Memuat dashboard admin...</div>
	{:else if errorMessage}
		<div class="panel diblokir">
			<p class="label-kecil">AKSES SISTEM</p>
			<h1 class="judul">Akses dibatasi</h1>
			<p>{errorMessage}</p>
		</div>
	{:else}
		<header class="bilah-halaman">
			<div>
				<p class="label-kecil">KONSOL ADMINISTRASI <span>/</span> MODERASI</p>
				<h1 class="judul">Ikhtisar moderasi</h1>
				<p class="subjudul">Status antrean persetujuan dan tindakan yang perlu ditinjau.</p>
			</div>
			<div class="informasi-bilah">
				<span class="lencana-peran">{adminLabel.toUpperCase()}</span>
				<span class="total-antrean"><strong>{shopCount + productCount}</strong> item menunggu</span>
			</div>
		</header>

		<section class="kisi-statistik" aria-label="Ringkasan antrean moderasi">
			<article class="kartu-statistik">
				<div class="atas-statistik"><span class="penanda-statistik toko"></span><span>ANTREAN TOKO</span><span class="kode-statistik">01</span></div>
				<strong>{shopCount}</strong>
				<small>Permohonan menunggu keputusan</small>
			</article>
			<article class="kartu-statistik">
				<div class="atas-statistik"><span class="penanda-statistik produk"></span><span>ANTREAN PRODUK</span><span class="kode-statistik">02</span></div>
				<strong>{productCount}</strong>
				<small>Produk menunggu pemeriksaan</small>
			</article>
			<article class="kartu-statistik kartu-total">
				<div class="atas-statistik"><span class="penanda-statistik total"></span><span>TOTAL TERTUNDA</span><span class="kode-statistik">ALL</span></div>
				<strong>{shopCount + productCount}</strong>
				<small>Item dalam seluruh antrean</small>
			</article>
		</section>

		<section class="bagian-antrean">
			<div class="kepala-bagian">
				<div>
					<p class="label-kecil">WORK QUEUE</p>
					<h2>Antrean pemeriksaan</h2>
				</div>
				<span class="label-diperbarui"><span></span> DATA TERKINI</span>
			</div>
			<div class="daftar-antrean">
				<article class="baris-antrean">
					<span class="urutan-antrean">01</span>
					<div class="informasi-antrean">
						<h3>Persetujuan toko</h3>
						<p>Verifikasi profil dan kelayakan toko baru.</p>
					</div>
					<div class="jumlah-antrean"><strong>{shopCount}</strong><span>menunggu</span></div>
					<a href="/toko" aria-label="Tinjau antrean persetujuan toko">Tinjau <span aria-hidden="true">&rarr;</span></a>
				</article>
				<article class="baris-antrean">
					<span class="urutan-antrean">02</span>
					<div class="informasi-antrean">
						<h3>Persetujuan produk</h3>
						<p>Periksa informasi, stok, dan detail katalog.</p>
					</div>
					<div class="jumlah-antrean"><strong>{productCount}</strong><span>menunggu</span></div>
					<a href="/admin/produk" aria-label="Tinjau antrean persetujuan produk">Tinjau <span aria-hidden="true">&rarr;</span></a>
				</article>
			</div>
		</section>
	{/if}
</div>

<style>
	.kerangka-halaman {
		width: 100%;
		max-width: 1480px;
		margin: 0 auto;
		padding: 34px 28px 64px;
	}
	.bilah-halaman {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
		margin-bottom: 28px;
	}
	.label-kecil {
		margin: 0 0 9px;
		font-size: 10px;
		letter-spacing: 0.12em;
		font-weight: 800;
		color: #4a7357;
	}
	.label-kecil span {
		padding: 0 5px;
		color: #9ba99c;
	}
	h1 {
		margin: 0;
		font-size: 34px;
		line-height: 1.15;
		font-weight: 700;
		color: #183126;
	}
	.subjudul {
		margin: 8px 0 0;
		color: #697b70;
		font-size: 13px;
	}
	.informasi-bilah {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-bottom: 3px;
	}
	.lencana-peran {
		display: inline-flex;
		align-items: center;
		min-height: 28px;
		padding: 0 9px;
		border: 1px solid #d8e1d8;
		border-radius: 5px;
		background: #fff;
		color: #52685a;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
	}
	.total-antrean {
		color: #697b70;
		font-size: 12px;
	}
	.total-antrean strong {
		margin-right: 4px;
		color: #183126;
		font-size: 15px;
	}
	.kisi-statistik {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin-bottom: 30px;
	}
	.kartu-statistik, .panel, .keadaan {
		background: #fff;
		border: 1px solid #dce4dc;
		border-radius: 6px;
	}
	.kartu-statistik {
		min-height: 124px;
		padding: 15px 17px;
	}
	.atas-statistik {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #687a6e;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
	}
	.penanda-statistik {
		width: 7px;
		height: 7px;
		border-radius: 2px;
		background: #64836b;
	}
	.penanda-statistik.produk {
		background: #c18b42;
	}
	.penanda-statistik.total {
		background: #345b48;
	}
	.kode-statistik {
		margin-left: auto;
		color: #9aa79d;
		font-size: 9px;
	}
	.kartu-statistik strong {
		display: block;
		margin-top: 15px;
		font-size: 28px;
		line-height: 1;
		color: #183126;
	}
	.kartu-statistik small {
		display: block;
		margin-top: 7px;
		color: #849087;
		font-size: 11px;
	}
	.bagian-antrean {
		border-top: 1px solid #d8e1d8;
	}
	.kepala-bagian {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		padding: 20px 0 13px;
	}
	.kepala-bagian .label-kecil {
		margin-bottom: 5px;
	}
	.kepala-bagian h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: #203c2d;
	}
	.label-diperbarui {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		color: #7d8c81;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
	}
	.label-diperbarui span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #5c9769;
	}
	.daftar-antrean {
		border-top: 1px solid #e1e7e1;
	}
	.baris-antrean {
		display: grid;
		grid-template-columns: 38px minmax(0, 1fr) 105px 82px;
		align-items: center;
		gap: 14px;
		min-height: 86px;
		border-bottom: 1px solid #e1e7e1;
	}
	.urutan-antrean {
		color: #9aa79d;
		font-size: 10px;
		font-weight: 800;
	}
	.informasi-antrean h3 {
		margin: 0;
		color: #203c2d;
		font-size: 14px;
		font-weight: 700;
	}
	.informasi-antrean p {
		margin: 5px 0 0;
		color: #79877d;
		font-size: 11px;
	}
	.jumlah-antrean {
		display: flex;
		align-items: baseline;
		gap: 7px;
	}
	.jumlah-antrean strong {
		color: #203c2d;
		font-size: 18px;
	}
	.jumlah-antrean span {
		color: #849087;
		font-size: 10px;
	}
	.baris-antrean a {
		justify-self: end;
		color: #326347;
		font-size: 11px;
		font-weight: 800;
		text-decoration: none;
	}
	.baris-antrean a span {
		padding-left: 4px;
	}
	.baris-antrean a:hover {
		color: #183126;
	}
	.keadaan,
			.diblokir {
		padding: 24px;
		max-width: 620px;
		margin: 48px auto;
	}
	.diblokir .label-kecil {
		margin-bottom: 8px;
	}
	.diblokir h1 {
		font-size: 26px;
	}
	.diblokir > p:last-child {
		margin-bottom: 0;
		color: #697b70;
		font-size: 13px;
	}
	@media (max-width: 680px) {
		.kerangka-halaman {
			padding: 28px 18px 52px;
		}
		.bilah-halaman {
			align-items: flex-start;
			flex-direction: column;
			gap: 15px;
		}
		.informasi-bilah {
			flex-wrap: wrap;
		}
		.kisi-statistik {
			grid-template-columns: 1fr;
			gap: 9px;
			margin-bottom: 24px;
		}
		.kartu-statistik {
			min-height: 110px;
		}
		.baris-antrean {
			grid-template-columns: 24px minmax(0, 1fr) 70px;
			gap: 10px;
			padding: 12px 0;
		}
		.jumlah-antrean {
			justify-content: flex-end;
		}
		.jumlah-antrean span {
			display: none;
		}
		.baris-antrean a {
			grid-column: 2 / 4;
			justify-self: start;
			padding-top: 2px;
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.bilah-halaman, .kartu-statistik, .baris-antrean {
			animation: muncul 320ms ease-out both;
		}
		.kartu-statistik:nth-child(2) {
			animation-delay: 40ms;
		}
		.kartu-statistik:nth-child(3) {
			animation-delay: 80ms;
		}
		@keyframes muncul {
			from {
				opacity: 0;
				transform: translateY(5px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	}
</style>
