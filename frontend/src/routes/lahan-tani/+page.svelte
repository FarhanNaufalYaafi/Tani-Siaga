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

<div class="page-shell">
	<div class="page-container">
		<div class="page-heading">
			<div>
				<p class="eyebrow">TANI SIAGA</p>
				<h1>Lahan Tani</h1>
				<p class="subtitle">Kelola dan lihat lahan tani yang terhubung dengan akunmu.</p>
			</div>
			<a class="create-button" href="/lahan-tani/create">+ Tambah Lahan</a>
		</div>
		<div class="toolbar">
			<input bind:value={search} oninput={handleSearch} placeholder="Cari nama lahan atau komoditas..." aria-label="Cari lahan tani" />
			<span>{pagination.total} lahan</span>
		</div>

		{#if isLoading}
			<div class="state-box">Memuat daftar lahan tani...</div>
		{:else if errorMessage}
			<div class="state-box error">
				<p>{errorMessage}</p>
				<button type="button" onclick={() => void loadFarmlands(1)}>Coba Lagi</button>
			</div>
		{:else if farmlands.length === 0}
			<div class="state-box">
				<div class="empty-icon">🌾</div>
				<h2>{search ? 'Lahan tidak ditemukan' : 'Belum ada lahan tani'}</h2>
				<p>{search ? 'Coba kata kunci nama lahan atau komoditas yang berbeda.' : 'Belum ada lahan yang terhubung dengan akun atau kelompokmu.'}</p>
			</div>
		{:else}
			<div class="section-heading">
				<div>
					<p class="eyebrow">{sourceLabel}</p>
					<h2>{pagination.total} Lahan Terdaftar</h2>
				</div>
			</div>

			<div class="farmland-grid">
				{#each farmlands as farmland (farmland.id)}
					<button type="button" class="farmland-card" onclick={() => goto(`/lahan-tani/${farmland.id}`)}>
						<div class="card-topline">
							<span class="crop-mark">{farmland.status === 'harvested' ? '🌾' : '🌱'}</span>
							<span class:harvested={farmland.status === 'harvested'} class="status-badge">{farmland.status === 'harvested' ? 'SUDAH PANEN' : 'AKTIF DITANAMI'}</span>
							<span class="detail-link">Lihat detail</span>
						</div>
						<h3>{farmland.name}</h3>
						<div class="card-info">
							<span>Luas area</span>
							<strong>{farmland.area_size} m²</strong>
						</div>
						<div class="card-info">
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
	.page-shell { min-height: 100vh; background: #f4f7f1; color: #183126; padding: 32px 20px 64px; }
	.page-container { max-width: 1100px; margin: 0 auto; }
	.page-heading, .section-heading { display: flex; justify-content: space-between; align-items: end; margin-bottom: 28px; }
		.toolbar { display: flex; align-items: center; gap: 16px; margin: 0 0 16px; }
		.toolbar input { box-sizing: border-box; flex: 1; min-width: 0; border: 1px solid #d6e1d5; border-radius: 7px; background: #fff; color: #183126; padding: 13px; font: inherit; outline: 0; }
		.toolbar input:focus { border-color: #39754b; box-shadow: 0 0 0 3px #39754b1c; }
		.toolbar span { color: #718077; font-size: 13px; white-space: nowrap; }
	.create-button { border-radius: 7px; background: #39754b; color: #fff; padding: 11px 15px; font-size: 12px; font-weight: 700; text-decoration: none; }
	.eyebrow { margin: 0 0 8px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
	h1 { margin: 0; font-size: clamp(30px, 5vw, 48px); line-height: 1; color: #183126; }
	h2 { margin: 0; font-size: 22px; }
	.subtitle, .state-box p { color: #66766d; font-size: 14px; }
	.farmland-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
	.farmland-card { text-align: left; border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; padding: 20px; cursor: pointer; box-shadow: 0 8px 22px rgba(35, 71, 46, .06); transition: transform .2s, border-color .2s, box-shadow .2s; }
	.farmland-card:hover { transform: translateY(-3px); border-color: #6eaa78; box-shadow: 0 12px 28px rgba(35, 71, 46, .12); }
	.card-topline, .card-info { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
	.crop-mark { font-size: 25px; }
	.status-badge { margin-left: auto; border-radius: 999px; background: #eaf4e9; color: #39754b; padding: 5px 8px; font-size: 9px; font-weight: 800; white-space: nowrap; }
	.status-badge.harvested { background: #fff0dc; color: #94651f; }
	.detail-link { color: #4e805a; font-size: 12px; font-weight: 700; }
	.farmland-card h3 { margin: 18px 0 20px; font-size: 18px; color: #183126; }
	.card-info { border-top: 1px solid #edf1eb; padding-top: 10px; margin-top: 10px; color: #718077; font-size: 12px; }
	.card-info strong { color: #274a32; font-size: 13px; }
	.state-box { border: 1px dashed #bdd0bd; border-radius: 10px; background: #fff; padding: 48px 20px; text-align: center; }
	.state-box h2 { margin: 12px 0 6px; }
	.state-box button { border: 0; border-radius: 7px; background: #39754b; color: #fff; padding: 10px 16px; cursor: pointer; }
	.state-box.error { border-color: #d69b9b; color: #a44242; }
	.empty-icon { font-size: 34px; }
	@media (max-width: 600px) { .page-shell { padding: 24px 14px 48px; } .page-heading { margin-bottom: 22px; } .toolbar { align-items: stretch; flex-direction: column; gap: 8px; } .toolbar span { align-self: flex-end; } }
</style>
