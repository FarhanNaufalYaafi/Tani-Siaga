<script lang="ts">
	import { page } from '$app/state';
	let isNotFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{isNotFound ? '404 | Halaman tidak ditemukan' : 'Terjadi gangguan'} | Tani Siaga</title>
</svelte:head>

<section class="error-page" aria-labelledby="error-title">
	<div class="error-content">
		<p class="eyebrow">TANI SIAGA · {page.status}</p>
		<h1 id="error-title">{isNotFound ? 'Halaman tidak ditemukan.' : 'Halaman ini belum bisa dibuka.'}</h1>
		<p>{isNotFound ? 'Tautan mungkin sudah berubah atau alamat yang dimasukkan tidak tepat.' : 'Coba kembali ke halaman utama atau jelajahi produk yang tersedia.'}</p>
		<div class="actions">
			<a class="primary-action" href="/dashboard">Ke Dashboard</a>
			<a class="secondary-action" href="/e-commerce">Jelajahi produk</a>
		</div>
	</div>
</section>

<style>
	.error-page { display: grid; flex: 1; place-items: center; min-height: 58vh; padding: 48px 20px 72px; color: #183126; }
	.error-content { width: min(100%, 700px); }
	.eyebrow { margin: 0 0 16px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .15em; }
	h1 { max-width: 650px; margin: 0; font: 600 clamp(38px, 7vw, 68px)/1.02 'Fraunces', Georgia, serif; }
	.error-content > p:not(.eyebrow) { max-width: 520px; margin: 18px 0 0; color: #687a6e; font-size: 15px; line-height: 1.65; }
	.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
	.primary-action, .secondary-action { display: inline-flex; min-height: 42px; align-items: center; justify-content: center; border-radius: 7px; padding: 11px 15px; font-size: 12px; font-weight: 800; text-decoration: none; }
	.primary-action { border: 1px solid #39754b; background: #39754b; color: #fff; }
	.secondary-action { border: 1px solid #a9c9aa; background: #fff; color: #39754b; }
	@media (max-width: 480px) { .error-page { min-height: 52vh; padding: 38px 20px 56px; } .actions { align-items: stretch; flex-direction: column; } }
</style>
