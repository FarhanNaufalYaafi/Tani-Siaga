<svelte:head>
	<title>Tentang Kami | Tani Siaga</title>
	<meta name="description" content="Kenali tim Tani Siaga, proyek ketahanan pangan dari siswa SMAN 1 Pamanukan." />
</svelte:head>

<main class="halaman-tentang">
	<section class="pengantar-tentang">
		<div class="teks-pengantar">
			<p class="label-kecil">DARI SMAN 1 PAMANUKAN</p>
			<h1 class="judul">Tani Siaga</h1>
			<p class="pengantar-pengantar">Teknologi yang tumbuh bersama petani.</p>
			<p class="deskripsi-pengantar">Tani Siaga dibuat untuk mewakili SMAN 1 Pamanukan dalam menghadirkan solusi digital bagi pertanian. Kami merangkai data cuaca, analisis cerdas, informasi pasar, dan akses perdagangan untuk ikut memperkuat ketahanan pangan.</p>
			<a class="tautan-sekolah" href="https://sma1pamanukan.sch.id" target="_blank" rel="noreferrer">Kunjungi situs sekolah <span>↗</span></a>
		</div>
		<figure class="gambar-sekolah">
			<img src="https://sma1pamanukan.sch.id/src/main/images/5e58142e6f7c383b01843aea77fcb055.png" alt="Lingkungan SMA Negeri 1 Pamanukan" />
			<figcaption>SMA Negeri 1 Pamanukan · Subang, Jawa Barat</figcaption>
		</figure>
	</section>

	<section class="bagian-tim" aria-labelledby="judul-tim">
		<div class="judul-bagian">
			<p class="label-kecil">TIM PENGEMBANG</p>
			<h2 id="judul-tim">Dibuat dengan semangat kolaborasi.</h2>
			<p>Dua peran, satu tujuan: membuat informasi pertanian lebih mudah digunakan.</p>
		</div>
		<div class="daftar-tim">
			<article class="anggota-tim">
				<span class="nomor-anggota">01</span>
				<div><h3>Farhan Naufal Yaafi</h3><p>Kelas 11 IPA 1 · Backend dan frontend</p></div>
				<a href="mailto:farhannaufalyaafi4@gmail.com">farhannaufalyaafi4@gmail.com <span>↗</span></a>
			</article>
			<article class="anggota-tim">
				<span class="nomor-anggota">02</span>
				<div><h3>Muhammad Rafa Al-Fauzan</h3><p>Kelas 11 IPA 2 · UI/UX</p></div>
				<a href="mailto:muhrafafauz@gmail.com">muhrafafauz@gmail.com <span>↗</span></a>
			</article>
		</div>
	</section>

	<section class="kontak-sekolah" aria-labelledby="judul-sekolah">
		<div>
			<p class="label-kecil">ASAL SEKOLAH</p>
			<h2 id="judul-sekolah">SMAN 1 Pamanukan</h2>
			<p>Proyek ini dikembangkan sebagai karya siswa untuk mewakili sekolah dan membawa gagasan pertanian digital dari Pamanukan.</p>
		</div>
		<address>
			<div><span>Alamat</span><strong>Jl. Eyang Tirtapraja No. 83, Kecamatan Pamanukan, Kabupaten Subang, Jawa Barat</strong></div>
			<div><span>Telepon</span><a href="tel:+62260551382">0260 551382</a></div>
			<div><span>Situs resmi</span><a href="https://sma1pamanukan.sch.id" target="_blank" rel="noreferrer">sma1pamanukan.sch.id ↗</a></div>
		</address>
	</section>
</main>

<style>
	.halaman-tentang {
		flex: 1;
		color: #183126;
	}
	.pengantar-tentang {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(340px, .9fr);
		gap: 8vw;
		align-items: center;
		max-width: 1240px;
		margin: 0 auto;
		padding: 70px 38px 82px;
	}
	.label-kecil {
		margin: 0 0 14px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .15em;
	}
	h1, h2, h3, p, figure {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 6px;
		font: 600 72px/.95 'Fraunces', Georgia, serif;
	}
	.pengantar-pengantar {
		margin: 0 0 20px;
		color: #39754b;
		font: 600 27px/1.2 'Fraunces', Georgia, serif;
	}
	.deskripsi-pengantar {
		max-width: 580px;
		margin-bottom: 25px;
		color: #687a6e;
		font-size: 15px;
		line-height: 1.75;
	}
	.tautan-sekolah {
		color: #39754b;
		font-size: 13px;
		font-weight: 800;
		text-decoration: none;
	}
	.tautan-sekolah span {
		padding-left: 8px;
		color: #bd8035;
	}
	.gambar-sekolah {
		position: relative;
		height: 390px;
		margin-bottom: 0;
		overflow: hidden;
		background: #dcebd8;
	}
	.gambar-sekolah img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.gambar-sekolah figcaption {
		position: absolute;
		right: 12px;
		bottom: 12px;
		left: 12px;
		padding: 11px 13px;
		background: #183126e8;
		color: #fff;
		font-size: 11px;
	}
	.bagian-tim {
		padding: 72px max(38px, calc((100% - 1164px) / 2)) 82px;
		background: #e8f0e5;
	}
	.judul-bagian {
		max-width: 650px;
		margin: 0 auto 34px;
	}
	.judul-bagian h2, .kontak-sekolah h2 {
		margin-bottom: 12px;
		font: 600 40px/1.05 'Fraunces', Georgia, serif;
	}
	.judul-bagian > p:last-child, .kontak-sekolah > div > p:last-child {
		margin-bottom: 0;
		color: #687a6e;
		font-size: 14px;
		line-height: 1.6;
	}
	.daftar-tim {
		max-width: 1164px;
		margin: 0 auto;
		border-top: 1px solid #b9d0b9;
	}
	.anggota-tim {
		display: grid;
		grid-template-columns: 55px 1fr minmax(190px, auto);
		align-items: center;
		gap: 18px;
		padding: 22px 0;
		border-bottom: 1px solid #b9d0b9;
	}
	.nomor-anggota {
		color: #39754b;
		font-size: 12px;
		font-weight: 800;
	}
	.anggota-tim h3 {
		margin: 0 0 5px;
		font: 700 19px 'DM Sans', sans-serif;
	}
	.anggota-tim p {
		margin: 0;
		color: #687a6e;
		font-size: 12px;
	}
	.anggota-tim a {
		color: #39754b;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.anggota-tim a span {
		padding-left: 5px;
	}
	.kontak-sekolah {
		display: grid;
		grid-template-columns: 1fr minmax(300px, .8fr);
		gap: 60px;
		align-items: start;
		max-width: 1240px;
		margin: 0 auto;
		padding: 78px 38px 90px;
	}
	.kontak-sekolah address {
		display: grid;
		gap: 18px;
		font-style: normal;
	}
	.kontak-sekolah address div {
		display: grid;
		gap: 5px;
		padding-bottom: 15px;
		border-bottom: 1px solid #d6e1d5;
	}
	.kontak-sekolah address span {
		color: #718077;
		font-size: 11px;
	}
	.kontak-sekolah address strong, .kontak-sekolah address a {
		color: #274a32;
		font-size: 13px;
		line-height: 1.55;
		text-decoration: none;
	}
	@media (max-width: 760px) {
		.pengantar-tentang, .kontak-sekolah {
			grid-template-columns: 1fr;
			gap: 32px;
			padding: 48px 22px 58px;
		}
		h1 {
			font-size: 58px;
		}
		.gambar-sekolah {
			height: 290px;
		}
		.bagian-tim {
			padding: 54px 22px 60px;
		}
		.judul-bagian h2, .kontak-sekolah h2 {
			font-size: 34px;
		}
		.anggota-tim {
			grid-template-columns: 34px 1fr;
			gap: 12px;
		}
		.anggota-tim a {
			grid-column: 2;
		}
	}
</style>