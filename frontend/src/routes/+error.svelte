<script lang="ts">
	import { page } from '$app/state';
	let isNotFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{isNotFound ? '404 | Halaman tidak ditemukan' : 'Terjadi gangguan'} | Tani Siaga</title>
</svelte:head>

<section class="halaman-galat" aria-labelledby="judul-galat">
	<div class="isi-galat">
		<p class="label-kecil">TANI SIAGA · {page.status}</p>
		<h1 id="judul-galat" class="judul">{isNotFound ? 'Halaman tidak ditemukan.' : 'Halaman ini belum bisa dibuka.'}</h1>
		<p>{isNotFound ? 'Tautan mungkin sudah berubah atau alamat yang dimasukkan tidak tepat.' : 'Coba kembali ke halaman utama atau jelajahi produk yang tersedia.'}</p>
		<div class="aksi">
			<a class="aksi-utama" href="/dashboard">Ke Dashboard</a>
			<a class="aksi-pendukung" href="/e-commerce">Jelajahi produk</a>
		</div>
	</div>
</section>

<style>
	.halaman-galat {
		display: grid;
		flex: 1;
		place-items: center;
		min-height: 58vh;
		padding: 48px 20px 72px;
		color: #183126;
	}
	.isi-galat {
		width: min(100%, 700px);
	}
	.label-kecil {
		margin: 0 0 16px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .15em;
	}
	h1 {
		max-width: 650px;
		margin: 0;
		font: 600 clamp(38px, 7vw, 68px)/1.02 'Fraunces', Georgia, serif;
	}
	.isi-galat > p:not(.label-kecil) {
		max-width: 520px;
		margin: 18px 0 0;
		color: #687a6e;
		font-size: 15px;
		line-height: 1.65;
	}
	.aksi {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 26px;
	}
	.aksi-utama, .aksi-pendukung {
		display: inline-flex;
		min-height: 42px;
		align-items: center;
		justify-content: center;
		border-radius: 7px;
		padding: 11px 15px;
		font-size: 12px;
		font-weight: 800;
		text-decoration: none;
	}
	.aksi-utama {
		border: 1px solid #39754b;
		background: #39754b;
		color: #fff;
	}
	.aksi-pendukung {
		border: 1px solid #a9c9aa;
		background: #fff;
		color: #39754b;
	}
	@media (max-width: 480px) {
		.halaman-galat {
			min-height: 52vh;
			padding: 38px 20px 56px;
		}
		.aksi {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
