<script lang="ts">
	import { onMount } from 'svelte';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { getProducts, type Product } from '$lib/api/product-api';

	let currentUser = $state<CurrentUserDto | null>(null);
	let preOrderProducts = $state<Product[]>([]);
	let readyProducts = $state<Product[]>([]);

	function revealOnScroll(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') {
			node.classList.add('reveal-visible');
			return { destroy() {} };
		}

		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.classList.add('reveal-visible');
					observer.unobserve(node);
				}
			}
		}, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

		node.classList.add('reveal-ready');
		observer.observe(node);
		return { destroy() { observer.disconnect(); } };
	}

	onMount(async () => {
		try { currentUser = await getCurrentUser(); } catch { currentUser = null; }
		try {
			const [preOrder, ready] = await Promise.all([getProducts('pre_order', 1, 6), getProducts('ready_stock', 1, 6)]);
			preOrderProducts = preOrder.data;
			readyProducts = ready.data;
		} catch { preOrderProducts = []; readyProducts = []; }
	});

	function formatPrice(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
</script>

<svelte:head><title>Dashboard | Tani Siaga</title></svelte:head>

<div class="dashboard-main">
	<section class="hero">
		<div class="hero-copy">
			<p class="eyebrow">DATA PERTANIAN UNTUK MASA DEPAN PANGAN</p>
			<h1>Cuaca terukur.<br /><em>Panen lebih siap.</em></h1>
			<p class="hero-text">Prakiraan BMKG dipadukan dengan analisis AI Gemini, data pertanian BPS, dan catatan komunitas Tani Siaga. Satu bekal yang lebih jelas untuk menjaga lahan, merencanakan panen, dan memperkuat ketahanan pangan.</p>
			<div class="source-chips" aria-label="Sumber data Tani Siaga"><span>BMKG</span><span>AI Gemini</span><span>BPS + data petani</span></div>
			<div class="hero-actions">
				<a class="primary-action" href={currentUser ? '/lahan-tani/create' : '/signin'}>{currentUser ? 'Mulai dari lahanmu' : 'Mulai bersama Tani Siaga'} <span>↗</span></a>
				<a class="secondary-action" href="/market-analysis">Lihat analisis pasar</a>
			</div>
		</div>
		<div class="hero-art" aria-label="Ilustrasi lahan pertanian">
			<div class="sun"></div>
			<div class="field field-back"></div>
			<div class="field field-mid"></div>
			<div class="field field-front"></div>
			<span class="art-label label-weather">Cuaca lokal<br /><strong>lebih siap</strong></span>
			<span class="art-label label-market">Pasar<br /><strong>lebih dekat</strong></span>
			<span class="plant">🌾</span>
		</div>
	</section>

	<section class="data-flow" aria-labelledby="data-flow-title" use:revealOnScroll>
		<div class="flow-heading"><p class="eyebrow">DARI DATA MENJADI AKSI</p><h2 id="data-flow-title">Lebih dari sekadar prakiraan.</h2><p>Informasi dari berbagai sumber dirangkai menjadi langkah yang relevan untuk setiap lahan.</p></div>
		<div class="flow-steps">
			<article><span class="step-mark bmkg-mark">01</span><p class="step-source">BMKG</p><h3>Kenali kondisi</h3><p>Cuaca lokal membantu petani membaca peluang dan risiko sebelum bekerja di lahan.</p></article>
			<article><span class="step-mark gemini-mark">02</span><p class="step-source">AI GEMINI</p><h3>Ubah jadi rekomendasi</h3><p>Data cuaca dan profil lahan dirangkum menjadi saran yang lebih mudah diterapkan.</p></article>
			<article><span class="step-mark bps-mark">03</span><p class="step-source">BPS + TANI SIAGA</p><h3>Pahami arah pasar</h3><p>Statistik pertanian dan data internal membantu membaca tren komoditas serta potensi wilayah.</p></article>
		</div>
	</section>

	<section class="resilience-strip" use:revealOnScroll>
		<div><p class="eyebrow">TUMBUH BERSAMA</p><h2>Keputusan yang lebih baik, pangan yang lebih tangguh.</h2><p>Tani Siaga mendekatkan informasi, petani, dan pasar agar hasil pertanian punya ruang tumbuh yang berkelanjutan.</p></div>
		<div class="resilience-links"><a href="/lahan-tani">Kelola lahan <span>↗</span></a><a href="/kelompok-tani">Temukan kelompok tani <span>↗</span></a></div>
	</section>

	<section class="commerce-banner" use:revealOnScroll>
		<div><p class="eyebrow">PANEN TERHUBUNG KE PASAR</p><h2>Rencanakan panen. Temukan pembelinya.</h2><p>Jelajahi produk siap kirim atau dukung hasil tani melalui sistem pre-order.</p></div>
		<div class="commerce-actions"><a href="/e-commerce">Jelajahi e-commerce <span>↗</span></a><a href="/pre-order">Lihat pre-order <span>↗</span></a></div>
	</section>

	<section class="market-section" use:revealOnScroll>
		<div class="section-title">
			<div>
				<p class="eyebrow">PASAR TANI SIAGA</p>
				<h2>Belanja langsung dari petani.</h2>
			</div>
			<a href="/e-commerce">Lihat semua produk ↗</a>
		</div>
		{@render ProductRail('Pre-order hasil panen', preOrderProducts, 'Belum ada hasil panen yang dibuka untuk pre-order.')}
		{@render ProductRail('Produk panen siap kirim', readyProducts, 'Belum ada produk panen siap kirim.')}
	</section>
</div>

{#snippet ProductRail(title: string, products: Product[], empty: string)}
	<div class="rail-block" use:revealOnScroll>
		<div class="rail-heading"><h3>{title}</h3><span>{products.length} produk pilihan</span></div>
		{#if products.length === 0}
			<p class="rail-empty">{empty}</p>
		{:else}
			<div class="product-rail">
				{#each products as product (product.id)}
					<a class="mini-product" href={`/e-commerce/${product.id}`}>
						<div class="mini-image">
							{#if product.image_url?.[0]}<img src={product.image_url[0]} alt={product.name} />{:else}<span>🌾</span>{/if}
							<b>{product.is_pre_order ? 'PRE-ORDER' : 'SIAP KIRIM'}</b>
						</div>
						<div class="mini-copy">
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
	.dashboard-main { flex: 1; color: #183126; }
	:global(.reveal-ready) { opacity: 0; transform: translateY(22px); transition: opacity .65s ease, transform .65s cubic-bezier(.2,.7,.2,1); }
	:global(.reveal-ready.reveal-visible) { opacity: 1; transform: translateY(0); }

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(400px, 0.9fr);
		gap: 65px;
		align-items: center;
		max-width: 1240px;
		margin: auto;
		padding: 70px 38px 100px;
	}
	.hero-copy { max-width: 650px; animation: hero-enter .7s both; }
	.eyebrow {
		margin: 0 0 18px;
		color: #4e805a;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.17em;
	}
	.hero h1 {
		margin: 0;
		color: #183126;
		font: 600 clamp(54px, 7.2vw, 88px)/.95 'Fraunces', Georgia, serif;
	}
	.hero h1 em { color: #39754b; font-style: normal; }
	.hero-text {
		max-width: 540px;
		margin: 32px 0 35px;
		color: #687a6e;
		font-size: 18px;
		line-height: 1.65;
	}
	.hero-actions {
		display: flex;
		align-items: center;
		gap: 20px;
		flex-wrap: wrap;
	}
	.source-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: -12px 0 28px; }
	.source-chips span { border: 1px solid #d6e1d5; border-radius: 999px; background: #ffffffa8; color: #48634e; padding: 7px 10px; font-size: 10px; font-weight: 800; }
	.primary-action {
		border-radius: 8px;
		background: #39754b;
		color: #fff;
		padding: 15px 19px;
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
		box-shadow: 0 8px 18px #39754b26;
	}
	.primary-action span { margin-left: 4px; color: #f7d88f; }
	.secondary-action { color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
	.hero-art { position: relative; aspect-ratio: 1.25; }
	.sun {
		position: absolute; top: 14%; right: 17%;
		width: 26%; height: 26%; border-radius: 50%;
		background: linear-gradient(180deg, #f7d88f 0%, #f1b44c 100%);
		box-shadow: 0 0 40px #f7d88f;
	}
	.field { position: absolute; left: 0; right: 0; }
	.field-back { bottom: 0; height: 65%; background: #9dc7a5; border-top-left-radius: 56% 100%; border-top-right-radius: 56% 100%; }
	.field-mid { bottom: 0; height: 52%; background: #7cb787; border-top-left-radius: 62% 100%; border-top-right-radius: 62% 100%; }
	.field-front { bottom: 0; height: 36%; background: #469560; border-top-left-radius: 70% 100%; border-top-right-radius: 70% 100%; }
	.art-label {
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
	.label-weather { top: 26%; left: 4%; }
	.label-weather strong { color: #39754b; }
	.label-market { bottom: 20%; right: 4%; }
	.label-market strong { color: #a8762e; }
	.plant { position: absolute; left: 26%; bottom: 7%; font-size: 64px; filter: drop-shadow(0 10px 5px #20312840); }

	.data-flow {
		max-width: 1180px;
		margin: 0 auto 100px;
		padding: 0 38px;
	}
	.flow-heading { max-width: 650px; margin-bottom: 34px; }
	.flow-heading .eyebrow { margin-bottom: 10px; }
	.flow-heading h2, .resilience-strip h2, .commerce-banner h2 { margin: 0; color: #183126; font: 600 42px/1.05 'Fraunces', Georgia, serif; }
	.flow-heading > p:last-child { max-width: 530px; margin: 14px 0 0; color: #687a6e; font-size: 15px; line-height: 1.6; }
	.flow-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid #cbdacb; border-bottom: 1px solid #cbdacb; }
	.flow-steps article { position: relative; min-height: 250px; padding: 28px 28px 30px 0; }
	.flow-steps article + article { border-left: 1px solid #cbdacb; padding-left: 28px; }
	.step-mark { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; color: #fff; font-size: 12px; font-weight: 800; }
	.bmkg-mark { background: #1769aa; }.gemini-mark { background: #39754b; }.bps-mark { background: #bd8035; }
	.step-source { margin: 20px 0 8px; color: #718077; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
	.flow-steps h3 { margin: 0 0 9px; color: #183126; font: 700 20px 'DM Sans', sans-serif; }
	.flow-steps article > p:last-child { max-width: 310px; margin: 0; color: #687a6e; font-size: 13px; line-height: 1.6; }
	.resilience-strip { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 36px; max-width: 1180px; margin: 0 auto 30px; padding: 38px; background: #e2efdf; border-top: 1px solid #c5ddc4; border-bottom: 1px solid #c5ddc4; }
	.resilience-strip .eyebrow, .commerce-banner .eyebrow { margin-bottom: 12px; }
	.resilience-strip h2 { max-width: 640px; font-size: 36px; }
	.resilience-strip > div > p:last-child, .commerce-banner > div > p:last-child { max-width: 630px; margin: 12px 0 0; color: #5c7462; font-size: 14px; line-height: 1.65; }
	.resilience-links, .commerce-actions { display: grid; min-width: 210px; }
	.resilience-links a, .commerce-actions a { display: flex; justify-content: space-between; gap: 20px; border-top: 1px solid #b5ceb4; padding: 13px 0; color: #275f3a; font-size: 13px; font-weight: 700; text-decoration: none; }
	.commerce-banner { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 35px; max-width: 1180px; margin: 0 auto 90px; padding: 34px 38px; background: #183126; color: #fff; }
	.commerce-banner h2 { max-width: 700px; color: #fff; font-size: 34px; }
	.commerce-banner > div > p:last-child { color: #c3d3c0; }
	.commerce-actions a { border-color: #58715e; color: #f7d88f; }
	.market-section { max-width: 1180px; margin: 0 auto 90px; padding: 0 38px; }
	.section-title {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 28px;
		gap: 18px;
		flex-wrap: wrap;
	}
	.section-title > div h2 { margin: 0; font: 600 clamp(30px, 3.6vw, 48px)/1 'Fraunces', Georgia, serif; }
	.section-title > a { color: #39754b; font-weight: 700; font-size: 14px; text-decoration: none; }

	.rail-block { margin-bottom: 44px; }
	.rail-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 18px;
	}
	.rail-heading h3 { margin: 0; color: #183126; font: 700 22px 'DM Sans', sans-serif; }
	.rail-heading span { color: #718077; font-size: 12px; font-weight: 700; }
	.rail-empty {
		padding: 28px;
		text-align: center;
		color: #718077;
		border: 1px dashed #b5d2b8;
		border-radius: 10px;
		background: #f6fbf4;
	}

	.product-rail {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 18px;
	}
	.mini-product {
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
	.mini-product:hover { transform: translateY(-4px); box-shadow: 0 12px 30px #23472e18; }
	.mini-image {
		position: relative;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: #dcebd8;
	}
	.mini-image img { width: 100%; height: 100%; object-fit: cover; }
	.mini-image span { font-size: 46px; }
	.mini-image b {
		position: absolute; top: 10px; left: 10px;
		border-radius: 5px; background: #183126; color: #fff;
		padding: 5px 8px; font-size: 9px; letter-spacing: 0.05em;
	}
	.mini-copy { display: grid; gap: 6px; padding: 16px 16px 18px; }
	.mini-copy h4 { margin: 0; color: #183126; font: 700 16px 'DM Sans', sans-serif; }
	.mini-copy span { color: #718077; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
	.mini-copy strong { margin-top: 4px; color: #39754b; font: 800 17px 'DM Sans', sans-serif; }

	@media (max-width: 1000px) {
		.hero { grid-template-columns: 1fr; padding: 60px 26px 70px; gap: 40px; }
		.data-flow { padding: 0 26px; margin-bottom: 70px; }
		.market-section { padding: 0 26px; }
		.resilience-strip, .commerce-banner { margin-left: 26px; margin-right: 26px; }
		.product-rail { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 620px) {
		.hero { padding: 46px 20px 54px; }
		.hero h1 { font-size: 56px; }
		.hero-text { margin: 24px 0 27px; font-size: 16px; }
		.data-flow, .market-section { padding: 0 20px; }
		.flow-heading h2, .resilience-strip h2, .commerce-banner h2 { font-size: 32px; }
		.flow-steps { grid-template-columns: 1fr; }
		.flow-steps article { min-height: auto; padding: 24px 0; }
		.flow-steps article + article { border-left: 0; border-top: 1px solid #cbdacb; padding-left: 0; }
		.resilience-strip, .commerce-banner { grid-template-columns: 1fr; gap: 24px; margin-left: 20px; margin-right: 20px; padding: 26px 22px; }
		.commerce-banner { margin-bottom: 64px; }
		.product-rail {
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
		.mini-product { flex: 0 0 min(82vw, 280px); scroll-snap-align: start; }
	}
	@keyframes hero-enter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
	@media (prefers-reduced-motion: reduce) { :global(.reveal-ready), .hero-copy { transition: none; animation: none; transform: none; } }
</style>
