<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { getGroupFarmlandsPage, getMyFarmlandsPage, type Farmland } from '$lib/api/farmland-api';
	import type { PaginationMeta } from '$lib/api/pagination';
	import Pagination from '$lib/components/Pagination.svelte';

	let farmlands = $state<Farmland[]>([]);
	let currentUser = $state<CurrentUserDto | null>(null);
	let groupId = $state<number | null | undefined>(undefined);
	let search = $state('');
	let page = $state(1);
	const pageSize = 8;
	let pagination = $state<PaginationMeta>({ page: 1, limit: pageSize, total: 0, total_pages: 1 });
	let isLoading = $state(true);
	let errorMessage = $state('');
	let sourceLabel = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		void loadFarmlands(1);
	});

	async function loadFarmlands(requestedPage = page) {
		isLoading = true;
		errorMessage = '';

		try {
			if (groupId === undefined) {
				currentUser = await getCurrentUser();
				groupId = currentUser.farmer_group_id || null;
				sourceLabel = groupId ? 'Lahan Kelompok Tani' : 'Lahan Pribadi';
			}
			const result = groupId
				? await getGroupFarmlandsPage(groupId, requestedPage, pageSize, search)
				: await getMyFarmlandsPage(requestedPage, pageSize, search);
			farmlands = result.data;
			pagination = result.meta;
			page = result.meta.page;
		} catch (error: any) {
			farmlands = [];
			errorMessage = error.message || 'Gagal memuat lahan tani.';
		} finally {
			isLoading = false;
		}
	}

	function handleSearch() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => { page = 1; void loadFarmlands(1); }, 300);
	}

	function changePage(nextPage: number) { page = nextPage; void loadFarmlands(nextPage); }
</script>

<svelte:head>
	<title>Lahan Tani | Tani Siaga</title>
</svelte:head>

<div class="kerangka-halaman">
	<div class="wadah-halaman">
		<div class="judul-halaman">
			<div>
				<p class="label-kecil">TANI SIAGA</p>
				<h1 class="judul">Lahan Tani</h1>
				<p class="subjudul">Kelola dan lihat lahan tani yang terhubung dengan akunmu.</p>
			</div>
			<a class="tombol-buat" href="/lahan-tani/create">+ Tambah Lahan</a>
		</div>
		<div class="bilah">
			<input bind:value={search} oninput={handleSearch} placeholder="Cari nama lahan atau komoditas..." aria-label="Cari lahan tani" />
			<span>{pagination.total} lahan</span>
		</div>

		{#if isLoading}
			<div class="kotak-keadaan">Memuat daftar lahan tani...</div>
		{:else if errorMessage}
			<div class="kotak-keadaan galat">
				<p>{errorMessage}</p>
				<button type="button" onclick={() => void loadFarmlands(1)}>Coba Lagi</button>
			</div>
		{:else if farmlands.length === 0}
			<div class="kotak-keadaan">
				<div class="ikon-kosong">🌾</div>
				<h2>{search ? 'Lahan tidak ditemukan' : 'Belum ada lahan tani'}</h2>
				<p>{search ? 'Coba kata kunci nama lahan atau komoditas yang berbeda.' : 'Belum ada lahan yang terhubung dengan akun atau kelompokmu.'}</p>
			</div>
		{:else}
			<div class="judul-bagian">
				<div>
					<p class="label-kecil">{sourceLabel}</p>
					<h2>{pagination.total} Lahan Terdaftar</h2>
				</div>
			</div>

			<div class="kisi-lahan">
				{#each farmlands as farmland (farmland.id)}
					<button type="button" class="kartu-lahan" onclick={() => goto(`/lahan-tani/${farmland.id}`)}>
						<div class="baris-kartu">
							<span class="penanda-tanaman">{farmland.status === 'harvested' ? '🌾' : '🌱'}</span>
							<span class:dipanen={farmland.status === 'harvested'} class="lencana-status">{farmland.status === 'harvested' ? 'SUDAH PANEN' : 'AKTIF DITANAMI'}</span>
							<span class="tautan-rincian">Lihat detail</span>
						</div>
						<h3>{farmland.name}</h3>
						<div class="informasi-kartu">
							<span>Luas area</span>
							<strong>{farmland.area_size} m²</strong>
						</div>
						<div class="informasi-kartu">
							<span>Komoditas</span>
							<strong>{farmland.commodity?.name || 'Belum ditentukan'}</strong>
						</div>
					</button>
				{/each}
			</div>
			<Pagination page={page} totalPages={pagination.total_pages} onPageChange={changePage} disabled={isLoading}/>
		{/if}
	</div>
</div>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f4f7f1;
		color: #183126;
		padding: 32px 20px 64px;
	}
	.wadah-halaman {
		max-width: 1100px;
		margin: 0 auto;
	}
	.judul-halaman, .judul-bagian {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 28px;
	}
	.bilah {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 0 0 16px;
	}
	.bilah input {
		box-sizing: border-box;
		flex: 1;
		min-width: 0;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fff;
		color: #183126;
		padding: 13px;
		font: inherit;
		outline: 0;
	}
	.bilah input:focus {
		border-color: #39754b;
		box-shadow: 0 0 0 3px #39754b1c;
	}
	.bilah span {
		color: #718077;
		font-size: 13px;
		white-space: nowrap;
	}
	.tombol-buat {
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 11px 15px;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
	}
	.label-kecil {
		margin: 0 0 8px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	h1 {
		margin: 0;
		font-size: clamp(30px, 5vw, 48px);
		line-height: 1;
		color: #183126;
	}
	h2 {
		margin: 0;
		font-size: 22px;
	}
	.subjudul, .kotak-keadaan p {
		color: #66766d;
		font-size: 14px;
	}
	.kisi-lahan {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 16px;
	}
	.kartu-lahan {
		text-align: left;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 20px;
		cursor: pointer;
		box-shadow: 0 8px 22px rgba(35, 71, 46, .06);
		transition: transform .2s, border-color .2s, box-shadow .2s;
	}
	.kartu-lahan:hover {
		transform: translateY(-3px);
		border-color: #6eaa78;
		box-shadow: 0 12px 28px rgba(35, 71, 46, .12);
	}
	.baris-kartu, .informasi-kartu {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.penanda-tanaman {
		font-size: 25px;
	}
	.lencana-status {
		margin-left: auto;
		border-radius: 999px;
		background: #eaf4e9;
		color: #39754b;
		padding: 5px 8px;
		font-size: 9px;
		font-weight: 800;
		white-space: nowrap;
	}
	.lencana-status.dipanen {
		background: #fff0dc;
		color: #94651f;
	}
	.tautan-rincian {
		color: #4e805a;
		font-size: 12px;
		font-weight: 700;
	}
	.kartu-lahan h3 {
		margin: 18px 0 20px;
		font-size: 18px;
		color: #183126;
	}
	.informasi-kartu {
		border-top: 1px solid #edf1eb;
		padding-top: 10px;
		margin-top: 10px;
		color: #718077;
		font-size: 12px;
	}
	.informasi-kartu strong {
		color: #274a32;
		font-size: 13px;
	}
	.kotak-keadaan {
		border: 1px dashed #bdd0bd;
		border-radius: 10px;
		background: #fff;
		padding: 48px 20px;
		text-align: center;
	}
	.kotak-keadaan h2 {
		margin: 12px 0 6px;
	}
	.kotak-keadaan button {
		border: 0;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 10px 16px;
		cursor: pointer;
	}
	.kotak-keadaan.galat {
		border-color: #d69b9b;
		color: #a44242;
	}
	.ikon-kosong {
		font-size: 34px;
	}
	@media (max-width: 600px) {
		.kerangka-halaman {
			padding: 24px 14px 48px;
		}
		.judul-halaman {
			margin-bottom: 22px;
		}
		.bilah {
			align-items: stretch;
			flex-direction: column;
			gap: 8px;
		}
		.bilah span {
			align-self: flex-end;
		}
	}
</style>
