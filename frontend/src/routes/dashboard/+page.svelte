<script lang="ts">
	import { onMount } from 'svelte';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { getProducts, type Product } from '$lib/api/product-api';
	import { applyAccountTheme, applyStoredAccountTheme, setAccountTheme } from '$lib/services/theme';

	let currentUser = $state<CurrentUserDto | null>(null);
	let isDarkTheme = $state(false);
	let preOrderProducts = $state<Product[]>([]);
	let readyProducts = $state<Product[]>([]);

	function revealOnScroll(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') {
			node.classList.add('terlihat');
			return { destroy() {} };
		}

		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.classList.add('terlihat');
					observer.unobserve(node);
				}
			}
		}, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

		node.classList.add('siap-muncul');
		observer.observe(node);
		return { destroy() { observer.disconnect(); } };
	}

	onMount(async () => {
		isDarkTheme = applyStoredAccountTheme();
		try { currentUser = await getCurrentUser(); } catch { currentUser = null; }
		isDarkTheme = applyAccountTheme(currentUser);
		try {
			const [preOrder, ready] = await Promise.all([getProducts('pre_order', 1, 6), getProducts('ready_stock', 1, 6)]);
			preOrderProducts = preOrder.data;
			readyProducts = ready.data;
		} catch { preOrderProducts = []; readyProducts = []; }
	});

	function toggleTheme() {
		isDarkTheme = !isDarkTheme;
		setAccountTheme(currentUser, isDarkTheme);
	}

	function formatPrice(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
</script>

<svelte:head><title>Dashboard | Tani Siaga</title></svelte:head>

<div class="utama-dasbor">
	<section class="utama">
		<div class="teks-utama">
			<p class="label-kecil">DATA PERTANIAN UNTUK MASA DEPAN PANGAN</p>
			<h1 class="judul">Cuaca terukur.<br /><em>Panen lebih siap.</em></h1>
			<p class="deskripsi-utama">Prakiraan BMKG dipadukan dengan analisis AI Gemini, data pertanian BPS, dan catatan komunitas Tani Siaga. Satu bekal yang lebih jelas untuk menjaga lahan, merencanakan panen, dan memperkuat ketahanan pangan.</p>
			<div class="label-sumber" aria-label="Sumber data Tani Siaga"><span>BMKG</span><span>AI Gemini</span><span>BPS + data petani</span></div>
			<div class="baris-aksi-utama">
				<a class="tombol-aksi-utama" href={currentUser ? '/lahan-tani/create' : '/signin'}>{currentUser ? 'Mulai dari lahanmu' : 'Mulai bersama Tani Siaga'} <span>↗</span></a>
				<a class="aksi-pendukung" href="/market-analysis">Lihat analisis pasar</a>
			</div>
		</div>
		<div class="ilustrasi-utama" aria-label="Ilustrasi lahan pertanian">
			<button
				type="button"
				class="matahari"
				class:gelap={isDarkTheme}
				aria-label="Aktifkan tema gelap"
				disabled={isDarkTheme}
				onclick={toggleTheme}
			></button>
			<button
				type="button"
				class="bulan"
				class:gelap={isDarkTheme}
				aria-label="Aktifkan tema terang"
				disabled={!isDarkTheme}
				onclick={toggleTheme}
			></button>
			<div class="bidang kembali-bidang"></div>
			<div class="bidang tengah-bidang"></div>
			<div class="bidang depan-bidang"></div>
			<span class="label-ilustrasi cuaca-label">Cuaca lokal<br /><strong>lebih siap</strong></span>
			<span class="label-ilustrasi pasar-label">Pasar<br /><strong>lebih dekat</strong></span>
			<span class="tanaman">🌾</span>
		</div>
	</section>

	<section class="alur-data" aria-labelledby="judul-alur-data" use:revealOnScroll>
		<div class="judul-alur"><p class="label-kecil">DARI DATA MENJADI AKSI</p><h2 id="judul-alur-data">Lebih dari sekadar prakiraan.</h2><p>Informasi dari berbagai sumber dirangkai menjadi langkah yang relevan untuk setiap lahan.</p></div>
		<div class="langkah-alur">
			<article><span class="penanda-langkah penanda-bmkg">01</span><p class="sumber-langkah">BMKG</p><h3>Kenali kondisi</h3><p>Cuaca lokal membantu petani membaca peluang dan risiko sebelum bekerja di lahan.</p></article>
			<article><span class="penanda-langkah penanda-gemini">02</span><p class="sumber-langkah">AI GEMINI</p><h3>Ubah jadi rekomendasi</h3><p>Data cuaca dan profil lahan dirangkum menjadi saran yang lebih mudah diterapkan.</p></article>
			<article><span class="penanda-langkah penanda-bps">03</span><p class="sumber-langkah">BPS + TANI SIAGA</p><h3>Pahami arah pasar</h3><p>Statistik pertanian dan data internal membantu membaca tren komoditas serta potensi wilayah.</p></article>
		</div>
	</section>

	<section class="bilah-ketangguhan" use:revealOnScroll>
		<div><p class="label-kecil">TUMBUH BERSAMA</p><h2>Keputusan yang lebih baik, pangan yang lebih tangguh.</h2><p>Tani Siaga mendekatkan informasi, petani, dan pasar agar hasil pertanian punya ruang tumbuh yang berkelanjutan.</p></div>
		<div class="tautan-ketangguhan"><a href="/lahan-tani">Kelola lahan <span>↗</span></a><a href="/kelompok-tani">Temukan kelompok tani <span>↗</span></a></div>
	</section>

	<section class="spanduk-niaga" use:revealOnScroll>
		<div><p class="label-kecil">PANEN TERHUBUNG KE PASAR</p><h2>Rencanakan panen. Temukan pembelinya.</h2><p>Jelajahi produk siap kirim atau dukung hasil tani melalui sistem pre-order.</p></div>
		<div class="aksi-niaga"><a href="/e-commerce">Jelajahi e-commerce <span>↗</span></a><a href="/pre-order">Lihat pre-order <span>↗</span></a></div>
	</section>

	<section class="bagian-pasar" use:revealOnScroll>
		<div class="judul-bagian">
			<div>
				<p class="label-kecil">PASAR TANI SIAGA</p>
				<h2>Belanja langsung dari petani.</h2>
			</div>
			<a href="/e-commerce">Lihat semua produk ↗</a>
		</div>
		{@render ProductRail('Pre-order hasil panen', preOrderProducts, 'Belum ada hasil panen yang dibuka untuk pre-order.')}
		{@render ProductRail('Produk panen siap kirim', readyProducts, 'Belum ada produk panen siap kirim.')}
	</section>
</div>

{#snippet ProductRail(title: string, products: Product[], empty: string)}
	<div class="blok-jalur" use:revealOnScroll>
		<div class="judul-jalur"><h3>{title}</h3><span>{products.length} produk pilihan</span></div>
		{#if products.length === 0}
			<p class="kosong-jalur">{empty}</p>
		{:else}
			<div class="jalur-produk">
				{#each products as product (product.id)}
					<a class="produk-mini" href={`/e-commerce/${product.id}`}>
						<div class="gambar-mini">
							{#if product.image_url?.[0]}<img src={product.image_url[0]} alt={product.name} />{:else}<span>🌾</span>{/if}
							<b>{product.is_pre_order ? 'PRE-ORDER' : 'SIAP KIRIM'}</b>
						</div>
						<div class="teks-mini">
							<h4>{product.name}</h4>
							<span>{product.shop?.name || 'Toko petani'}</span>
							<strong>{formatPrice(product.price)}</strong>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<style>
	.utama-dasbor {
		flex: 1;
		color: #183126;
	}
	:global(.siap-muncul) {
		opacity: 0;
		transform: translateY(22px);
		transition: opacity .65s ease, transform .65s cubic-bezier(.2,.7,.2,1);
	}
	:global(.siap-muncul.terlihat) {
		opacity: 1;
		transform: translateY(0);
	}
	.utama {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(400px, 0.9fr);
		gap: 65px;
		align-items: center;
		max-width: 1240px;
		margin: auto;
		padding: 70px 38px 100px;
	}
	.teks-utama {
		max-width: 650px;
		animation: masuk-utama .7s both;
	}
	.label-kecil {
		margin: 0 0 18px;
		color: #4e805a;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.17em;
	}
	.utama h1 {
		margin: 0;
		color: #183126;
		font: 600 clamp(54px, 7.2vw, 88px)/.95 'Fraunces', Georgia, serif;
	}
	.utama h1 em {
		color: #39754b;
		font-style: normal;
	}
	.deskripsi-utama {
		max-width: 540px;
		margin: 32px 0 35px;
		color: #687a6e;
		font-size: 18px;
		line-height: 1.65;
	}
	.baris-aksi-utama {
		display: flex;
		align-items: center;
		gap: 20px;
		flex-wrap: wrap;
	}
	.label-sumber {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin: -12px 0 28px;
	}
	.label-sumber span {
		border: 1px solid #d6e1d5;
		border-radius: 999px;
		background: #ffffffa8;
		color: #48634e;
		padding: 7px 10px;
		font-size: 10px;
		font-weight: 800;
	}
	.tombol-aksi-utama {
		border-radius: 8px;
		background: #39754b;
		color: #fff;
		padding: 15px 19px;
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
		box-shadow: 0 8px 18px #39754b26;
	}
	.tombol-aksi-utama span {
		margin-left: 4px;
		color: #f7d88f;
	}
	.aksi-pendukung {
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.ilustrasi-utama {
		position: relative;
		width: 100%;
		max-width: 520px;
		aspect-ratio: 1;
		margin-inline: auto;
	}
	.matahari {
		position: absolute;
		top: 10%;
		right: 17%;
		width: clamp(96px, 25%, 132px);
		height: auto;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 0;
		padding: 0;
		appearance: none;
		background: radial-gradient(circle at 34% 30%, #fff1b7 0%, #f7d36f 48%, #efad42 100%);
		box-shadow: 0 0 0 10px #f7d88f2e, 0 0 48px #f4c56c99;
		cursor: pointer;
		transition: top .65s ease, box-shadow .5s ease;
	}
	.matahari.gelap {
		top: 66%;
	}
	.matahari:disabled {
		cursor: default;
	}
	.matahari:not(:disabled), .bulan.gelap {
		animation: petunjuk-ubah-tema 5s ease-in-out infinite;
		will-change: transform;
	}
	.matahari:focus-visible, .bulan:focus-visible {
		outline: 3px solid #39754b;
		outline-offset: 5px;
	}
	.bulan {
		position: absolute;
		top: 66%;
		right: 17%;
		width: clamp(96px, 25%, 132px);
		aspect-ratio: 1;
		border-radius: 50%;
		border: 0;
		padding: 0;
		appearance: none;
		background: #f5f0d2;
		box-shadow: 0 0 30px #dce8ff66;
		mask: radial-gradient(circle at 68% 30%, transparent 0 47%, #000 49%);
		opacity: 0;
		pointer-events: none;
		cursor: pointer;
		transition: top .65s ease, opacity .2s ease .45s;
	}
	.bulan.gelap {
		top: 8%;
		opacity: 1;
		pointer-events: auto;
		transition: top .65s ease, opacity .2s ease;
	}
	.bidang {
		position: absolute;
		left: 0;
		right: 0;
	}
	.kembali-bidang {
		bottom: 0;
		height: 65%;
		background: #9dc7a5;
		border-top-left-radius: 56% 100%;
		border-top-right-radius: 56% 100%;
	}
	.tengah-bidang {
		bottom: 0;
		height: 52%;
		background: #7cb787;
		border-top-left-radius: 62% 100%;
		border-top-right-radius: 62% 100%;
	}
	.depan-bidang {
		bottom: 0;
		height: 36%;
		background: #469560;
		border-top-left-radius: 70% 100%;
		border-top-right-radius: 70% 100%;
	}
	.label-ilustrasi {
		position: absolute;
		min-width: 130px;
		padding: 12px 14px;
		border-radius: 10px;
		background: #ffffffdd;
		backdrop-filter: blur(5px);
		color: #374a3c;
		font-size: 11px;
		font-weight: 700;
		line-height: 1.3;
		box-shadow: 0 10px 25px #14302016;
	}
	.cuaca-label {
		top: 26%;
		left: 4%;
	}
	.cuaca-label strong {
		color: #39754b;
	}
	.pasar-label {
		bottom: 20%;
		right: 4%;
	}
	.pasar-label strong {
		color: #a8762e;
	}
	.tanaman {
		position: absolute;
		left: 26%;
		bottom: 7%;
		font-size: 64px;
		filter: drop-shadow(0 10px 5px #20312840);
	}
	.alur-data {
		max-width: 1180px;
		margin: 0 auto 100px;
		padding: 0 38px;
	}
	.judul-alur {
		max-width: 650px;
		margin-bottom: 34px;
	}
	.judul-alur .label-kecil {
		margin-bottom: 10px;
	}
	.judul-alur h2, .bilah-ketangguhan h2, .spanduk-niaga h2 {
		margin: 0;
		color: #183126;
		font: 600 42px/1.05 'Fraunces', Georgia, serif;
	}
	.judul-alur > p:last-child {
		max-width: 530px;
		margin: 14px 0 0;
		color: #687a6e;
		font-size: 15px;
		line-height: 1.6;
	}
	.langkah-alur {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border-top: 1px solid #cbdacb;
		border-bottom: 1px solid #cbdacb;
	}
	.langkah-alur article {
		position: relative;
		min-height: 250px;
		padding: 28px 28px 30px 0;
	}
	.langkah-alur article + article {
		border-left: 1px solid #cbdacb;
		padding-left: 28px;
	}
	.penanda-langkah {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		color: #fff;
		font-size: 12px;
		font-weight: 800;
	}
	.penanda-bmkg {
		background: #1769aa;
	}
	.penanda-gemini {
		background: #39754b;
	}
	.penanda-bps {
		background: #bd8035;
	}
	.sumber-langkah {
		margin: 20px 0 8px;
		color: #718077;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: .12em;
	}
	.langkah-alur h3 {
		margin: 0 0 9px;
		color: #183126;
		font: 700 20px 'DM Sans', sans-serif;
	}
	.langkah-alur article > p:last-child {
		max-width: 310px;
		margin: 0;
		color: #687a6e;
		font-size: 13px;
		line-height: 1.6;
	}
	.bilah-ketangguhan {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: 36px;
		max-width: 1180px;
		margin: 0 auto 30px;
		padding: 38px;
		background: #e2efdf;
		border-top: 1px solid #c5ddc4;
		border-bottom: 1px solid #c5ddc4;
	}
	.bilah-ketangguhan .label-kecil, .spanduk-niaga .label-kecil {
		margin-bottom: 12px;
	}
	.bilah-ketangguhan h2 {
		max-width: 640px;
		font-size: 36px;
	}
	.bilah-ketangguhan > div > p:last-child, .spanduk-niaga > div > p:last-child {
		max-width: 630px;
		margin: 12px 0 0;
		color: #5c7462;
		font-size: 14px;
		line-height: 1.65;
	}
	.tautan-ketangguhan, .aksi-niaga {
		display: grid;
		min-width: 210px;
	}
	.tautan-ketangguhan a, .aksi-niaga a {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		border-top: 1px solid #b5ceb4;
		padding: 13px 0;
		color: #275f3a;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.spanduk-niaga {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: 35px;
		max-width: 1180px;
		margin: 0 auto 90px;
		padding: 34px 38px;
		background: #183126;
		color: #fff;
	}
	.spanduk-niaga h2 {
		max-width: 700px;
		color: #fff;
		font-size: 34px;
	}
	.spanduk-niaga > div > p:last-child {
		color: #c3d3c0;
	}
	.aksi-niaga a {
		border-color: #58715e;
		color: #f7d88f;
	}
	.bagian-pasar {
		max-width: 1180px;
		margin: 0 auto 90px;
		padding: 0 38px;
	}
	.judul-bagian {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 28px;
		gap: 18px;
		flex-wrap: wrap;
	}
	.judul-bagian > div h2 {
		margin: 0;
		font: 600 clamp(30px, 3.6vw, 48px)/1 'Fraunces', Georgia, serif;
	}
	.judul-bagian > a {
		color: #39754b;
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
	}
	.blok-jalur {
		margin-bottom: 44px;
	}
	.judul-jalur {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 18px;
	}
	.judul-jalur h3 {
		margin: 0;
		color: #183126;
		font: 700 22px 'DM Sans', sans-serif;
	}
	.judul-jalur span {
		color: #718077;
		font-size: 12px;
		font-weight: 700;
	}
	.kosong-jalur {
		padding: 28px;
		text-align: center;
		color: #718077;
		border: 1px dashed #b5d2b8;
		border-radius: 10px;
		background: #f6fbf4;
	}
	.jalur-produk {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 18px;
	}
	.produk-mini {
		display: grid;
		grid-template-rows: 170px 1fr;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		background: #fff;
		text-decoration: none;
		color: inherit;
		overflow: hidden;
		box-shadow: 0 8px 20px #23472e0c;
		transition: transform 0.2s, box-shadow 0.2s;
	}
	.produk-mini:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 30px #23472e18;
	}
	.gambar-mini {
		position: relative;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: #dcebd8;
	}
	.gambar-mini img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.gambar-mini span {
		font-size: 46px;
	}
	.gambar-mini b {
		position: absolute;
		top: 10px;
		left: 10px;
		border-radius: 5px;
		background: #183126;
		color: #fff;
		padding: 5px 8px;
		font-size: 9px;
		letter-spacing: 0.05em;
	}
	.teks-mini {
		display: grid;
		gap: 6px;
		padding: 16px 16px 18px;
	}
	.teks-mini h4 {
		margin: 0;
		color: #183126;
		font: 700 16px 'DM Sans', sans-serif;
	}
	.teks-mini span {
		color: #718077;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.teks-mini strong {
		margin-top: 4px;
		color: #39754b;
		font: 800 17px 'DM Sans', sans-serif;
	}
	@media (max-width: 1000px) {
		.utama {
			grid-template-columns: 1fr;
			padding: 60px 26px 70px;
			gap: 40px;
		}
		.alur-data {
			padding: 0 26px;
			margin-bottom: 70px;
		}
		.bagian-pasar {
			padding: 0 26px;
		}
		.bilah-ketangguhan, .spanduk-niaga {
			margin-left: 26px;
			margin-right: 26px;
		}
		.jalur-produk {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 620px) {
		.utama {
			padding: 46px 20px 54px;
		}
		.utama h1 {
			font-size: 56px;
		}
		.deskripsi-utama {
			margin: 24px 0 27px;
			font-size: 16px;
		}
		.alur-data, .bagian-pasar {
			padding: 0 20px;
		}
		.judul-alur h2, .bilah-ketangguhan h2, .spanduk-niaga h2 {
			font-size: 32px;
		}
		.langkah-alur {
			grid-template-columns: 1fr;
		}
		.langkah-alur article {
			min-height: auto;
			padding: 24px 0;
		}
		.langkah-alur article + article {
			border-left: 0;
			border-top: 1px solid #cbdacb;
			padding-left: 0;
		}
		.bilah-ketangguhan, .spanduk-niaga {
			grid-template-columns: 1fr;
			gap: 24px;
			margin-left: 20px;
			margin-right: 20px;
			padding: 26px 22px;
		}
		.spanduk-niaga {
			margin-bottom: 64px;
		}
		.jalur-produk {
			display: flex;
			gap: 12px;
			width: 100%;
			min-width: 0;
			overflow-x: auto;
			padding: 4px 2px 14px;
			scroll-snap-type: x mandatory;
			scrollbar-width: thin;
			overscroll-behavior-x: contain;
		}
		.produk-mini {
			flex: 0 0 min(82vw, 280px);
			scroll-snap-align: start;
		}
	}
	@keyframes masuk-utama {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes petunjuk-ubah-tema {
		0%, 54%, 100% { transform: translateY(0) scale(1); }
		58% { transform: translateY(8px) scale(0.96); }
		62%, 66% { transform: translateY(0) scale(1); }
		70% { transform: translateY(8px) scale(0.96); }
		74% { transform: translateY(0) scale(1); }
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.siap-muncul), .teks-utama {
			transition: none;
			animation: none;
			transform: none;
		}
		.matahari:not(:disabled), .bulan.gelap {
			animation: none;
		}
	}
</style>
