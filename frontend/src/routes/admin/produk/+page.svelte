<script lang="ts">
	import { onMount } from 'svelte';
	import {
		approveProduct,
		getPendingProductApprovals,
		rejectProduct,
		type AdminProductApproval,
	} from '$lib/api/admin-api';
	import Pagination from '$lib/components/Pagination.svelte';
	import { showInput } from '$lib/services/dialog';

	let items = $state<AdminProductApproval[]>([]);
	let page = $state(1);
	let totalPages = $state(1);
	let total = $state(0);
	let limit = $state(8);
	let search = $state('');
	let loading = $state(true);
	let errorMessage = $state('');

	async function loadData() {
		loading = true;
		errorMessage = '';
		try {
			const result = await getPendingProductApprovals(page, limit, search);
			items = result.data;
			total = result.meta.total;
			totalPages = result.meta.total_pages;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memuat data produk.';
		} finally {
			loading = false;
		}
	}

	function onSearch() {
		page = 1;
		void loadData();
	}

	async function handleApprove(id: number) {
		await approveProduct(id);
		await loadData();
	}

	async function handleReject(id: number) {
		const reason = await showInput({
			title: 'Tolak produk',
			message: 'Berikan alasan penolakan untuk disampaikan kepada pemilik toko.',
			input: {
				label: 'Alasan penolakan',
				value: 'Produk belum sesuai standar.',
				placeholder: 'Tulis alasan penolakan',
			},
			confirmLabel: 'Tolak produk',
			cancelLabel: 'Batal',
			tone: 'warning',
		});
		if (reason === null) return;
		await rejectProduct(id, reason.trim() || undefined);
		await loadData();
	}

	onMount(() => {
		void loadData();
	});
</script>

<svelte:head>
	<title>Persetujuan Produk | Tani Siaga</title>
</svelte:head>

<div class="kerangka-halaman">
	<header class="kepala-halaman-admin">
		<div>
			<p class="label-kecil">ADMIN</p>
			<h1 class="judul">Persetujuan produk</h1>
		</div>
		<a class="tautan-kembali" href="/admin">← Kembali ke dashboard</a>
	</header>

	<div class="bilah-pencarian-produk">
		<input
			bind:value={search}
			oninput={onSearch}
			placeholder="Cari nama produk atau toko"
			type="search"
		/>
		<span>{total} menunggu</span>
	</div>

	{#if loading}
		<div class="keadaan">Memuat data produk...</div>
	{:else if errorMessage}
		<div class="keadaan galat">{errorMessage}</div>
	{:else if items.length === 0}
		<div class="keadaan">Belum ada produk yang menunggu persetujuan.</div>
	{:else}
		<div class="daftar">
			{#each items as product}
				<article class="kartu">
					<div class="kepala-kartu">
						<div>
							<h2>{product.name}</h2>
							<p>{product.shop?.name || 'Toko tidak diketahui'}</p>
						</div>
						<span class="lencana">Pending</span>
					</div>
					<p class="deskripsi" title={product.description}>{product.description || 'Tidak ada deskripsi produk.'}</p>
					<div class="informasi">
						<span>Harga: Rp {Number(product.price).toLocaleString('id-ID')}</span>
						<span>Stok: {product.stock}</span>
					</div>
					<div class="aksi">
						<button class="utama" type="button" onclick={() => handleApprove(product.id)}>Setujui</button>
						<button class="pendukung" type="button" onclick={() => handleReject(product.id)}>Tolak</button>
					</div>
				</article>
			{/each}
		</div>

	{/if}
	<Pagination {page} {totalPages} onPageChange={(nextPage) => { page = nextPage; void loadData(); }} disabled={loading} />
</div>

<style>
	.kerangka-halaman {
		width: min(100%, 1000px);
		margin: 0 auto;
		padding: 32px 20px 64px;
	}
	.kepala-halaman-admin {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 18px;
	}
	.label-kecil {
		margin: 0 0 6px;
		font-size: 11px;
		letter-spacing: 0.12em;
		font-weight: 800;
		color: #4a7357;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 3vw, 2.8rem);
	}
	.tautan-kembali {
		color: #1e5b35;
		font-weight: 700;
		text-decoration: none;
	}
	.bilah-pencarian-produk {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 18px;
		padding: 14px 18px;
		background: #fff;
		border: 1px solid #dee7df;
		border-radius: 14px;
	}
	.bilah-pencarian-produk input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid #d4dfd5;
		border-radius: 10px;
		font: inherit;
	}
	.bilah-pencarian-produk span {
		font-weight: 700;
		color: #3e674a;
	}
	.daftar {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: stretch;
		gap: 14px;
	}
	.kartu {
		display: flex;
		flex-direction: column;
		min-height: 248px;
		background: #fff;
		border: 1px solid #dfe7df;
		border-radius: 10px;
		padding: 18px;
	}
	.kepala-kartu {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 14px;
		min-height: 48px;
		margin-bottom: 10px;
	}
	.kepala-kartu > div {
		min-width: 0;
	}
	.kepala-kartu h2 {
		margin: 0 0 4px;
		font-size: 1.2rem;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}
	.kepala-kartu p {
		display: -webkit-box;
		line-clamp: 1;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 1;
		overflow: hidden;
	}
	.kepala-kartu p,
			.deskripsi,
			.informasi {
		margin: 0;
		color: #536d5a;
	}
	.lencana {
		display: inline-flex;
		align-self: flex-start;
		align-items: center;
		justify-content: center;
		width: max-content;
		height: auto;
		text-align: center;
		line-height: 1.2;
		padding: 6px 10px;
		border-radius: 999px;
		background: #fff3d6;
		color: #845b0b;
		font-size: 11px;
		font-weight: 800;
	}
	.deskripsi {
		display: -webkit-box;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		min-height: 3.2em;
		max-height: 3.2em;
		overflow: hidden;
		line-height: 1.6;
		margin: 12px 0;
	}
	.informasi {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		font-size: 12px;
		font-weight: 600;
		margin-bottom: 14px;
	}
	.aksi {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: auto;
	}
	button {
		border: 0;
		border-radius: 10px;
		padding: 10px 12px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	button.utama {
		background: #1d6f3d;
		color: #fff;
	}
	button.pendukung {
		background: #edf5ea;
		color: #1c4f30;
	}
	.keadaan {
		padding: 24px;
		background: #fff;
		border: 1px solid #e0e9e0;
		border-radius: 14px;
		text-align: center;
		color: #4d6355;
	}
	.keadaan.galat {
		color: #9b3a38;
		background: #fff0ef;
	}
	@media (max-width: 720px) {
		.daftar {
			grid-template-columns: 1fr;
		}
		.kepala-halaman-admin,
		.bilah-pencarian-produk {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
