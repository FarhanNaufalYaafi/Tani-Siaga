<script lang="ts">
  import { onMount } from 'svelte';
  import {
    applyToFarmerGroup,
    dissolveAdminFarmerGroup,
    getAdminFarmerGroupPage,
    getFarmerGroupPage,
    removeAdminFarmerGroupMember,
    type FarmerGroup,
    type FarmerMember,
  } from '$lib/api/farmer-group-api';
  import type { PaginationMeta } from '$lib/api/pagination';
  import Pagination from '$lib/components/Pagination.svelte';
  import { goto } from '$app/navigation';
  import { getCurrentUser } from '$lib/api/auth-api';
  import { showAlert, showConfirm, showInput } from '$lib/services/dialog';

  let groups = $state<FarmerGroup[]>([]);
  let search = $state('');
  let page = $state(1);
  const pageSize = 8;
  let pagination = $state<PaginationMeta>({ page: 1, limit: pageSize, total: 0, total_pages: 1 });
  let isLoading = $state(true);
  let errorMessage = $state('');
  let isAdmin = $state(false);
  let actionLoadingId = $state<number | null>(null);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  let applyingId = $state<string | number | null>(null);
  let pendingAppliedIds = $state<Set<string | number>>(new Set());

  onMount(async () => {
    try {
      const user = await getCurrentUser();
      isAdmin = user.role === 'admin';
    } catch {
      isAdmin = false;
    }
    await fetchData(1);
  });

  async function fetchData(requestedPage = page) {
    isLoading = true;
    errorMessage = '';
    try {
      const result = isAdmin
        ? await getAdminFarmerGroupPage(requestedPage, pageSize, search)
        : await getFarmerGroupPage(requestedPage, pageSize, search);
      if (result.data.length === 0 && requestedPage > result.meta.total_pages) {
        page = result.meta.total_pages;
        await fetchData(page);
        return;
      }
      groups = result.data;
      pagination = result.meta;
      page = result.meta.page;
      pendingAppliedIds = new Set(result.data.filter((group) => group.isPending).map((group) => group.id));
    } catch (err: any) {
      errorMessage = err.message || 'Terjadi kesalahan saat memuat data.';
    } finally {
      isLoading = false;
    }
  }

  function handleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { page = 1; void fetchData(1); }, 300);
  }

  function changePage(nextPage: number) { page = nextPage; void fetchData(nextPage); }

  function handleDetail(id: string | number) {
    goto(`/kelompok-tani/${id}`);
  }

  async function handleApply(id: string | number) {
    applyingId = id;
    try {
      await applyToFarmerGroup(id);
      const newSet = new Set(pendingAppliedIds);
      newSet.add(id);
      pendingAppliedIds = newSet;
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mengajukan bergabung.', { title: 'Pengajuan gagal', tone: 'error' });
    } finally {
      applyingId = null;
    }
  }

  async function handleDissolve(group: FarmerGroup) {
    const reason = await showInput({
      title: 'Bubarkan kelompok tani',
      message: `Kelompok "${group.name}" dan keanggotaannya akan dihapus. Alasan akan dikirim kepada seluruh anggota.`,
      input: { label: 'Alasan pembubaran', placeholder: 'Tulis alasan pembubaran', required: true },
      confirmLabel: 'Bubarkan kelompok',
      tone: 'warning',
    });
    if (reason === null) return;
    actionLoadingId = Number(group.id);
    try {
      await dissolveAdminFarmerGroup(Number(group.id), reason);
      await fetchData(page);
    } catch (err: any) {
      await showAlert(err.message || 'Gagal membubarkan kelompok tani.', { title: 'Aksi gagal', tone: 'error' });
    } finally {
      actionLoadingId = null;
    }
  }

  async function handleRemoveMember(group: FarmerGroup, member: FarmerMember) {
    if (!await showConfirm(`Keluarkan ${member.email} dari kelompok "${group.name}"?`, { title: 'Keluarkan anggota?', confirmLabel: 'Keluarkan', tone: 'warning' })) return;
    actionLoadingId = member.id;
    try {
      await removeAdminFarmerGroupMember(member.id);
      await fetchData(page);
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mengeluarkan anggota.', { title: 'Aksi gagal', tone: 'error' });
    } finally {
      actionLoadingId = null;
    }
  }
</script>

<svelte:head>
  <title>Kelompok Tani | Tani Siaga</title>
</svelte:head>

<main class="kerangka-halaman">
  <div class="wadah-halaman">
    <div class="judul">
      <div>
        <p class="label-kecil">KOLABORASI PETANI</p>
        <h1 class="judul">Kelompok Tani</h1>
        <p class="subjudul">{isAdmin ? 'Kelola kelompok tani dan anggotanya.' : 'Temukan kelompok, ajukan bergabung, atau buat ruang kolaborasi untuk petani.'}</p>
      </div>
      {#if !isAdmin}<a class="utama" href="/kelompok-tani/create">+ Buat kelompok tani</a>{/if}
    </div>

    <div class="bilah">
      <input bind:value={search} oninput={handleSearch} placeholder="Cari nama kelompok atau ID Poktan..." aria-label="Cari kelompok tani" />
      <span>{pagination.total} kelompok</span>
    </div>

    {#if errorMessage}
      <div class="peringatan" role="alert">
        <p>{errorMessage}</p>
        <button type="button" onclick={() => void fetchData(1)}>Coba lagi</button>
      </div>
    {/if}

    {#if isLoading}
      <div class="kisi" aria-label="Memuat kelompok tani">
        {#each Array(6) as _, index (index)}
          <div class="kerangka-kelompok" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </div>
        {/each}
      </div>
    {:else if groups.length === 0}
      <div class="keadaan keadaan-kosong">
        <span class="penanda-kosong" aria-hidden="true">🌾</span>
        <h2>{search ? 'Kelompok tidak ditemukan' : 'Belum ada kelompok tani'}</h2>
        <p>{search ? 'Coba kata kunci atau ID Poktan yang berbeda.' : 'Jadilah yang pertama membuat kelompok dan mulai berkolaborasi dengan petani lain.'}</p>
        {#if !search}<a class="utama" href="/kelompok-tani/create">Buat kelompok tani</a>{/if}
      </div>
    {:else}
      <div class="judul-daftar">
        <h2>{isAdmin ? 'Kelompok tani' : 'Kelompok tersedia'}</h2>
        <span>{pagination.total} kelompok</span>
      </div>
      <div class="kisi">
        {#each groups as group (group.id)}
          <article class="kartu-kelompok">
            <div class="isi-kelompok">
              <div class="baris-judul-kelompok">
                <h3>{group.name}</h3>
                <span class="jumlah-anggota">{group.members?.length || 0} anggota</span>
              </div>
              {#if group.poktan_id}<p class="kode-kelompok">ID Poktan · {group.poktan_id}</p>{/if}
              <p class="deskripsi">{group.description || 'Belum ada deskripsi singkat.'}</p>
            </div>
            <div class="aksi">
              <button class="pendukung" type="button" onclick={() => handleDetail(group.id)}>Lihat detail</button>
              {#if isAdmin}
                <button class="bahaya" type="button" onclick={() => handleDissolve(group)} disabled={actionLoadingId === Number(group.id)}>
                  {actionLoadingId === Number(group.id) ? 'Memproses...' : 'Bubarkan'}
                </button>
              {:else if pendingAppliedIds.has(group.id) || group.isPending}
                <button class="menunggu" type="button" disabled>Menunggu respons</button>
              {:else}
                <button class="gabung" type="button" onclick={() => handleApply(group.id)} disabled={applyingId === group.id}>
                  {#if applyingId === group.id}<span class="indikator" aria-hidden="true"></span><span>Mengajukan...</span>
                  {:else}<span>{group.applicationStatus === 'rejected' ? 'Ajukan lagi' : 'Ajukan bergabung'}</span>{/if}
                </button>
              {/if}
            </div>
            {#if isAdmin && group.members?.length}
              <div class="daftar-anggota-admin">
                <p>Anggota kelompok</p>
                {#each group.members as member (member.id)}
                  <div class="baris-anggota-admin">
                    <span>{member.email}{member.role === 'group_leader' ? ' · Ketua' : ''}</span>
                    {#if member.role !== 'group_leader'}
                      <button type="button" onclick={() => handleRemoveMember(group, member)} disabled={actionLoadingId === member.id}>
                        {actionLoadingId === member.id ? '...' : 'Keluarkan'}
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </article>
        {/each}
      </div>
      <Pagination page={page} totalPages={pagination.total_pages} onPageChange={changePage} disabled={isLoading}/>
    {/if}
  </div>
</main>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f4f7f1;
		color: #183126;
		padding: 36px 20px 68px;
	}
	.wadah-halaman {
		width: min(100%, 1000px);
		margin: 0 auto;
	}
	.judul {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 30px;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	h1 {
		margin: 0;
		font: 600 clamp(38px, 6vw, 56px)/1.02 'Fraunces', Georgia, serif;
	}
	.subjudul {
		max-width: 580px;
		margin: 14px 0 0;
		color: #718077;
		line-height: 1.6;
	}
	.utama {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 42px;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 11px 15px;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		transition: background-color .18s;
	}
	.utama:hover {
		background: #2d603c;
	}
	.judul-daftar {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
		margin-bottom: 14px;
	}
	.bilah {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 0 0 18px;
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
	.judul-daftar h2 {
		margin: 0;
		color: #183126;
		font-size: 19px;
	}
	.judul-daftar span {
		color: #718077;
		font-size: 13px;
	}
	.kisi {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}
	.kartu-kelompok {
		display: flex;
		min-width: 0;
		flex-direction: column;
		justify-content: space-between;
		gap: 22px;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 20px;
		box-shadow: 0 8px 22px #23472e0a;
		transition: transform .18s, border-color .18s, box-shadow .18s;
	}
	.kartu-kelompok:hover {
		transform: translateY(-2px);
		border-color: #77a87b;
		box-shadow: 0 12px 26px #23472e12;
	}
	.baris-judul-kelompok {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.baris-judul-kelompok h3 {
		margin: 0;
		color: #183126;
		font-size: 19px;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	.jumlah-anggota {
		flex: 0 0 auto;
		border: 1px solid #d6e8d5;
		border-radius: 999px;
		background: #eaf4e9;
		color: #39754b;
		padding: 5px 9px;
		font-size: 11px;
		font-weight: 700;
	}
	.kode-kelompok {
		margin: 9px 0 0;
		color: #4e805a;
		font-size: 12px;
	}
	.deskripsi {
		display: -webkit-box;
		min-height: 42px;
		margin: 13px 0 0;
		overflow: hidden;
		color: #718077;
		font-size: 13px;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}
	.aksi {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 9px;
		border-top: 1px solid #e8eee6;
		padding-top: 15px;
	}
	.aksi button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		min-height: 38px;
		border: 1px solid #39754b;
		border-radius: 7px;
		padding: 8px 10px;
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		line-height: 1.25;
		cursor: pointer;
		transition: background-color .18s, border-color .18s, opacity .18s;
	}
	.aksi button:focus-visible, .utama:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 2px;
	}
	.pendukung {
		background: #fff;
		color: #39754b;
	}
	.pendukung:hover {
		background: #f4faf2;
	}
	.gabung {
		background: #39754b;
		color: #fff;
	}
	.gabung:hover:not(:disabled) {
		border-color: #2d603c;
		background: #2d603c;
	}
	.aksi button:disabled {
		cursor: not-allowed;
		opacity: .7;
	}
	.menunggu {
		border-color: #e6d4a9 !important;
		background: #fff8e7;
		color: #946b26;
	}
	.bahaya {
		border-color: #edc9c6 !important;
		background: #fff0ef;
		color: #a44242;
	}
	.daftar-anggota-admin {
		display: grid;
		gap: 7px;
		border-top: 1px solid #e8eee6;
		padding-top: 13px;
	}
	.daftar-anggota-admin > p {
		margin: 0 0 2px;
		color: #718077;
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
	}
	.baris-anggota-admin {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		color: #536d5a;
		font-size: 11px;
	}
	.baris-anggota-admin span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.baris-anggota-admin button {
		flex: 0 0 auto;
		border: 1px solid #edc9c6;
		border-radius: 6px;
		background: #fff0ef;
		color: #a44242;
		padding: 5px 8px;
		font: inherit;
		font-size: 10px;
		font-weight: 700;
		cursor: pointer;
	}
	.baris-anggota-admin button:disabled {
		opacity: .6;
		cursor: wait;
	}
	.indikator {
		width: 13px;
		height: 13px;
		border: 2px solid #ffffff80;
		border-top-color: #fff;
		border-radius: 50%;
		animation: putar .7s linear infinite;
	}
	.keadaan {
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 28px;
		color: #718077;
	}
	.keadaan-kosong {
		padding: 52px 24px;
		text-align: center;
	}
	.penanda-kosong {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		margin: 0 auto 14px;
		border-radius: 50%;
		background: #eaf4e9;
		font-size: 24px;
	}
	.keadaan-kosong h2 {
		margin: 0;
		color: #183126;
		font-size: 21px;
	}
	.keadaan-kosong p {
		max-width: 460px;
		margin: 9px auto 20px;
		line-height: 1.6;
	}
	.kerangka-kelompok {
		display: grid;
		gap: 14px;
		min-height: 190px;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 20px;
	}
	.kerangka-kelompok span {
		height: 13px;
		border-radius: 4px;
		background: #e8eee6;
		animation: denyut 1.3s ease-in-out infinite alternate;
	}
	.kerangka-kelompok span:first-child {
		width: 60%;
		height: 20px;
	}
	.kerangka-kelompok span:nth-child(3) {
		width: 80%;
	}
	.kerangka-kelompok span:last-child {
		width: 100%;
		height: 36px;
		align-self: end;
	}
	.peringatan {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
		border: 1px solid #edc9c6;
		border-radius: 8px;
		background: #fff0ef;
		padding: 12px 14px;
		color: #a44242;
		font-size: 13px;
	}
	.peringatan p {
		margin: 0;
	}
	.peringatan button {
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}
	@keyframes putar {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes denyut {
		to {
			opacity: .55;
		}
	}
	@media (max-width: 700px) {
		.kisi {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.kerangka-halaman {
			padding: 36px 14px 56px;
		}
		.judul {
			align-items: flex-start;
			flex-direction: column;
			gap: 18px;
			margin-bottom: 24px;
		}
		.utama {
			width: 100%;
		}
		.kartu-kelompok {
			padding: 17px;
		}
		.aksi {
			grid-template-columns: 1fr;
		}
		.bilah {
			align-items: stretch;
			flex-direction: column;
			gap: 8px;
		}
		.bilah span {
			align-self: flex-end;
		}
		.peringatan {
			align-items: flex-start;
			flex-direction: column;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kartu-kelompok, .utama, .aksi button {
			transition: none;
		}
		.indikator, .kerangka-kelompok span {
			animation: none;
		}
	}
</style>