<script lang="ts">
  import { onMount } from 'svelte';
  import { getFarmerGroupPage, applyToFarmerGroup, type FarmerGroup } from '$lib/api/farmer-group-api';
  import type { PaginationMeta } from '$lib/api/pagination';
  import Pagination from '$lib/components/Pagination.svelte';
  import { goto } from '$app/navigation';
  import { showAlert } from '$lib/services/dialog';

  let groups = $state<FarmerGroup[]>([]);
  let search = $state('');
  let page = $state(1);
  const pageSize = 8;
  let pagination = $state<PaginationMeta>({ page: 1, limit: pageSize, total: 0, total_pages: 1 });
  let isLoading = $state(true);
  let errorMessage = $state('');
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  let applyingId = $state<string | number | null>(null);
  let pendingAppliedIds = $state<Set<string | number>>(new Set());

  onMount(() => { void fetchData(1); });

  async function fetchData(requestedPage = page) {
    isLoading = true;
    errorMessage = '';
    try {
      const result = await getFarmerGroupPage(requestedPage, pageSize, search);
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
</script>

<svelte:head>
  <title>Kelompok Tani | Tani Siaga</title>
</svelte:head>

<main class="page-shell">
  <div class="page-container">
    <div class="heading">
      <div>
        <p class="eyebrow">KOLABORASI PETANI</p>
        <h1>Kelompok Tani</h1>
        <p class="subtitle">Temukan kelompok, ajukan bergabung, atau buat ruang kolaborasi untuk petani.</p>
      </div>
      <a class="primary" href="/kelompok-tani/create">+ Buat kelompok tani</a>
    </div>

    <div class="toolbar">
      <input bind:value={search} oninput={handleSearch} placeholder="Cari nama kelompok atau ID Poktan..." aria-label="Cari kelompok tani" />
      <span>{pagination.total} kelompok</span>
    </div>

    {#if errorMessage}
      <div class="alert" role="alert">
        <p>{errorMessage}</p>
        <button type="button" onclick={() => void fetchData(1)}>Coba lagi</button>
      </div>
    {/if}

    {#if isLoading}
      <div class="grid" aria-label="Memuat kelompok tani">
        {#each Array(6) as _, index (index)}
          <div class="group-skeleton" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </div>
        {/each}
      </div>
    {:else if groups.length === 0}
      <div class="state empty-state">
        <span class="empty-mark" aria-hidden="true">🌾</span>
        <h2>{search ? 'Kelompok tidak ditemukan' : 'Belum ada kelompok tani'}</h2>
        <p>{search ? 'Coba kata kunci atau ID Poktan yang berbeda.' : 'Jadilah yang pertama membuat kelompok dan mulai berkolaborasi dengan petani lain.'}</p>
        {#if !search}<a class="primary" href="/kelompok-tani/create">Buat kelompok tani</a>{/if}
      </div>
    {:else}
      <div class="list-heading">
        <h2>Kelompok tersedia</h2>
        <span>{pagination.total} kelompok</span>
      </div>
      <div class="grid">
        {#each groups as group (group.id)}
          <article class="group-card">
            <div class="group-content">
              <div class="group-title-row">
                <h3>{group.name}</h3>
                <span class="member-count">{group.members?.length || 0} anggota</span>
              </div>
              {#if group.poktan_id}<p class="group-code">ID Poktan · {group.poktan_id}</p>{/if}
              <p class="description">{group.description || 'Belum ada deskripsi singkat.'}</p>
            </div>
            <div class="actions">
              <button class="secondary" type="button" onclick={() => handleDetail(group.id)}>Lihat detail</button>
              {#if pendingAppliedIds.has(group.id) || group.isPending}
                <button class="pending" type="button" disabled>Menunggu respons</button>
              {:else}
                <button class="join" type="button" onclick={() => handleApply(group.id)} disabled={applyingId === group.id}>
                  {#if applyingId === group.id}<span class="spinner" aria-hidden="true"></span><span>Mengajukan...</span>
                  {:else}<span>{group.applicationStatus === 'rejected' ? 'Ajukan lagi' : 'Ajukan bergabung'}</span>{/if}
                </button>
              {/if}
            </div>
          </article>
        {/each}
      </div>
      <Pagination page={page} totalPages={pagination.total_pages} onPageChange={changePage} disabled={isLoading}/>
    {/if}
  </div>
</main>

<style>
  .page-shell { min-height: 100vh; background: #f4f7f1; color: #183126; padding: 36px 20px 68px; }
  .page-container { width: min(100%, 1000px); margin: 0 auto; }
  .heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 30px; }
  .eyebrow { margin: 0 0 9px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
  h1 { margin: 0; font: 600 clamp(38px, 6vw, 56px)/1.02 'Fraunces', Georgia, serif; }
  .subtitle { max-width: 580px; margin: 14px 0 0; color: #718077; line-height: 1.6; }
  .primary { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; border-radius: 7px; background: #39754b; color: #fff; padding: 11px 15px; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; transition: background-color .18s; }
  .primary:hover { background: #2d603c; }
  .list-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
  .toolbar { display: flex; align-items: center; gap: 16px; margin: 0 0 18px; }
    .toolbar input { box-sizing: border-box; flex: 1; min-width: 0; border: 1px solid #d6e1d5; border-radius: 7px; background: #fff; color: #183126; padding: 13px; font: inherit; outline: 0; }
    .toolbar input:focus { border-color: #39754b; box-shadow: 0 0 0 3px #39754b1c; }
    .toolbar span { color: #718077; font-size: 13px; white-space: nowrap; }
  .list-heading h2 { margin: 0; color: #183126; font-size: 19px; }
  .list-heading span { color: #718077; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .group-card { display: flex; min-width: 0; flex-direction: column; justify-content: space-between; gap: 22px; border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; padding: 20px; box-shadow: 0 8px 22px #23472e0a; transition: transform .18s, border-color .18s, box-shadow .18s; }
  .group-card:hover { transform: translateY(-2px); border-color: #77a87b; box-shadow: 0 12px 26px #23472e12; }
  .group-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .group-title-row h3 { margin: 0; color: #183126; font-size: 19px; line-height: 1.3; overflow-wrap: anywhere; }
  .member-count { flex: 0 0 auto; border: 1px solid #d6e8d5; border-radius: 999px; background: #eaf4e9; color: #39754b; padding: 5px 9px; font-size: 11px; font-weight: 700; }
  .group-code { margin: 9px 0 0; color: #4e805a; font-size: 12px; }
  .description { display: -webkit-box; min-height: 42px; margin: 13px 0 0; overflow: hidden; color: #718077; font-size: 13px; line-clamp: 2; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 9px; border-top: 1px solid #e8eee6; padding-top: 15px; }
  .actions button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; border: 1px solid #39754b; border-radius: 7px; padding: 8px 10px; font: inherit; font-size: 12px; font-weight: 700; line-height: 1.25; cursor: pointer; transition: background-color .18s, border-color .18s, opacity .18s; }
  .actions button:focus-visible, .primary:focus-visible { outline: 3px solid #5c95684d; outline-offset: 2px; }
  .secondary { background: #fff; color: #39754b; }
  .secondary:hover { background: #f4faf2; }
  .join { background: #39754b; color: #fff; }
  .join:hover:not(:disabled) { border-color: #2d603c; background: #2d603c; }
  .actions button:disabled { cursor: not-allowed; opacity: .7; }
  .pending { border-color: #e6d4a9 !important; background: #fff8e7; color: #946b26; }
  .spinner { width: 13px; height: 13px; border: 2px solid #ffffff80; border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
  .state { border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; padding: 28px; color: #718077; }
  .empty-state { padding: 52px 24px; text-align: center; }
  .empty-mark { display: grid; place-items: center; width: 48px; height: 48px; margin: 0 auto 14px; border-radius: 50%; background: #eaf4e9; font-size: 24px; }
  .empty-state h2 { margin: 0; color: #183126; font-size: 21px; }
  .empty-state p { max-width: 460px; margin: 9px auto 20px; line-height: 1.6; }
  .group-skeleton { display: grid; gap: 14px; min-height: 190px; border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; padding: 20px; }
  .group-skeleton span { height: 13px; border-radius: 4px; background: #e8eee6; animation: pulse 1.3s ease-in-out infinite alternate; }
  .group-skeleton span:first-child { width: 60%; height: 20px; }.group-skeleton span:nth-child(3) { width: 80%; }.group-skeleton span:last-child { width: 100%; height: 36px; align-self: end; }
  .alert { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; border: 1px solid #edc9c6; border-radius: 8px; background: #fff0ef; padding: 12px 14px; color: #a44242; font-size: 13px; }
  .alert p { margin: 0; }.alert button { border: 0; background: transparent; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { to { opacity: .55; } }
  @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
  @media (max-width: 560px) { .page-shell { padding: 36px 14px 56px; }.heading { align-items: flex-start; flex-direction: column; gap: 18px; margin-bottom: 24px; }.primary { width: 100%; }.group-card { padding: 17px; }.actions { grid-template-columns: 1fr; }.toolbar { align-items: stretch; flex-direction: column; gap: 8px; }.toolbar span { align-self: flex-end; }.alert { align-items: flex-start; flex-direction: column; } }
  @media (prefers-reduced-motion: reduce) { .group-card, .primary, .actions button { transition: none; }.spinner, .group-skeleton span { animation: none; } }
</style>