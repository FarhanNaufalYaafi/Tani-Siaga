<script lang="ts">
	let { reason, evidenceUrls = [], bannedUntil } = $props<{
		reason?: string | null;
		evidenceUrls?: string[];
		bannedUntil: string;
	}>();

	let endDate = $derived(new Date(bannedUntil));
	let remainingDays = $derived(Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000)));
	let formattedEndDate = $derived(
		Number.isNaN(endDate.getTime())
			? 'Belum ditentukan'
			: new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(endDate),
	);
</script>

<section class="halaman-sanksi" aria-labelledby="judul-sanksi">
	<div class="judul-sanksi">
		<span class="ikon-sanksi" aria-hidden="true">!</span>
		<div>
			<p class="label-kecil">AKSES TOKO DIBATASI</p>
			<h1 id="judul-sanksi" class="judul">Toko dinonaktifkan sementara</h1>
			<p class="pengantar">Fitur penjualan, pengelolaan produk, dan konfirmasi pesanan tidak tersedia selama masa sanksi.</p>
		</div>
	</div>

	<div class="rincian-sanksi">
		<div class="baris-rincian">
			<span>Alasan sanksi</span>
			<strong>{reason || 'Silakan hubungi tim Tani Siaga untuk informasi lebih lanjut.'}</strong>
		</div>
		{#if evidenceUrls.length}
			<section class="bukti">
				<p class="label-kecil">BUKTI SANKSI</p>
				<div class="kisi-bukti">
					{#each evidenceUrls as image}
						<a href={image} target="_blank" rel="noopener noreferrer"><img src={image} alt="Bukti foto sanksi toko" /></a>
					{/each}
				</div>
			</section>
		{/if}
		<div class="baris-rincian baris-durasi">
			<span>Masa sanksi</span>
			<strong>{remainingDays === 1 ? 'Tersisa 1 hari' : `Tersisa ${remainingDays} hari`}</strong>
			<small>Berakhir {formattedEndDate}</small>
		</div>
	</div>

	<div class="baris-dukungan">
		<div>
			<p class="label-kecil">LANGKAH SELANJUTNYA</p>
			<p>Untuk klarifikasi atau bantuan terkait sanksi, hubungi tim Tani Siaga.</p>
		</div>
		<a href="mailto:farhannaufalyaafi4@gmail.com">Hubungi dukungan <span aria-hidden="true">↗</span></a>
	</div>
</section>

<style>
	.halaman-sanksi {
		width: min(100%, 880px);
		margin: 0 auto;
		padding: 54px 28px 68px;
		color: #183126;
	}
	.judul-sanksi {
		display: grid;
		grid-template-columns: 54px minmax(0, 1fr);
		gap: 18px;
		align-items: start;
		padding-bottom: 27px;
		border-bottom: 1px solid #edc9c6;
	}
	.ikon-sanksi {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border: 1px solid #edc9c6;
		border-radius: 50%;
		background: #fff0ef;
		color: #a44242;
		font-size: 22px;
		font-weight: 800;
	}
	.label-kecil {
		margin: 0 0 8px;
		color: #a44242;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .12em;
	}
	h1 {
		margin: 0;
		color: #183126;
		font: 600 38px/1.15 'Fraunces', Georgia, serif;
	}
	.pengantar {
		max-width: 660px;
		margin: 12px 0 0;
		color: #718077;
		font-size: 14px;
		line-height: 1.6;
	}
	.rincian-sanksi {
		display: grid;
		grid-template-columns: 1.2fr .8fr;
		gap: 0;
		border-bottom: 1px solid #e4ebe2;
	}
	.baris-rincian {
		display: grid;
		align-content: start;
		gap: 9px;
		padding: 23px 22px 23px 0;
	}
	.baris-rincian + .baris-rincian {
		padding-left: 22px;
		border-left: 1px solid #e4ebe2;
	}
	.baris-rincian > span {
		color: #718077;
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
	}
	.baris-rincian strong {
		color: #a44242;
		font-size: 15px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	.baris-rincian small {
		color: #718077;
		font-size: 12px;
	}
	.baris-dukungan {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 24px;
		padding-top: 23px;
	}
	.baris-dukungan .label-kecil {
		margin-bottom: 6px;
		color: #4e805a;
	}
	.baris-dukungan p:last-child {
		margin: 0;
		color: #718077;
		font-size: 13px;
		line-height: 1.5;
	}
	.baris-dukungan a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 9px;
		flex: 0 0 auto;
		min-height: 42px;
		border: 1px solid #39754b;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 10px 14px;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
	}
	.baris-dukungan a:hover {
		border-color: #2d603c;
		background: #2d603c;
	}
	.bukti {
		padding: 20px 0;
		border-bottom: 1px solid #e4ebe2;
	}
	.kisi-bukti {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.kisi-bukti img {
		width: 112px;
		height: 112px;
		border: 1px solid #edc9c6;
		border-radius: 8px;
		object-fit: cover;
	}
	@media (max-width: 620px) {
		.halaman-sanksi {
			padding: 35px 18px 50px;
		}
		.judul-sanksi {
			grid-template-columns: 42px minmax(0, 1fr);
			gap: 13px;
		}
		.ikon-sanksi {
			width: 40px;
			height: 40px;
			font-size: 18px;
		}
		h1 {
			font-size: 30px;
		}
		.rincian-sanksi {
			grid-template-columns: 1fr;
		}
		.baris-rincian {
			padding: 18px 0;
		}
		.baris-rincian + .baris-rincian {
			padding-left: 0;
			border-top: 1px solid #e4ebe2;
			border-left: 0;
		}
		.baris-dukungan {
			align-items: flex-start;
			flex-direction: column;
			gap: 15px;
		}
		.baris-dukungan a {
			width: 100%;
		}
	}
</style>
