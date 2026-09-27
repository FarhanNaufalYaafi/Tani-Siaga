<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import {
    getFarmerGroupById,
    applyToFarmerGroup,
    removeGroupMember,
    addGroupMember,
    getPendingMembers,
    approveMember,
    rejectMember,
    leaveFarmerGroup,
    type FarmerGroup,
    type FarmerMember
  } from '$lib/api/farmer-group-api';
  import { getGroupFarmlands } from '$lib/api/farmland-api';
  import { getCurrentUser } from '$lib/api/auth-api';
  import { showAlert, showConfirm, showInput } from '$lib/services/dialog';

  let groupId = $derived(page.params.id);

  let group = $state<FarmerGroup | null>(null);
  let isLoading = $state(true);
  let errorMessage = $state('');

  let isApplying = $state(false);
  let isPending = $state(false);
  let applicationStatus = $state<FarmerGroup['applicationStatus']>(null);
  let isLeaving = $state(false);

  // Farmland State
  let groupFarmlands = $state<any[]>([]);
  let isLoadingFarmlands = $state(false);

  // Status Modals & Leader Actions
  let showPendingModal = $state(false);
  let pendingList = $state<FarmerMember[]>([]);
  let isLoadingPending = $state(false);

  let isAddingMember = $state(false);

  let actionLoadingId = $state<number | null>(null);

  // 1. Mengambil data user saat ini dari localStorage
  let currentUser = $state<any>(null);

  onMount(() => {
    void loadCurrentUser();
  });

  async function loadCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        currentUser = parsed.user || parsed;
      } catch (e) {
        console.error('Gagal membaca data user:', e);
      }
    }

    if (!currentUser) {
      try {
        currentUser = await getCurrentUser();
        localStorage.setItem('user', JSON.stringify(currentUser));
      } catch (e) {
        console.error('Gagal mengambil user aktif:', e);
      }
    }
  }

  // 2. Email Ketua Kelompok Tani (Berdasarkan group_leader_id)
  let leaderEmail = $derived.by(() => {
    if (!group || !group.members || !group.group_leader_id) return 'Tidak diketahui';
    const leader = group.members.find((m) => Number(m.id) === Number(group?.group_leader_id));
    return leader ? leader.email : `User #${group.group_leader_id}`;
  });

  // 3. LOGIKA UTAMA: User dianggap LEADER HANYA JIKA dia adalah ketua di kelompok ini!
  let isLeader = $derived.by(() => {
    if (!group || !currentUser || !group.group_leader_id) return false;

    const currentUserId = Number(currentUser.id || currentUser.userId);
    const groupLeaderId = Number(group.group_leader_id);

    // Cek pencocokan ID (User Login === Ketua Kelompok Ini)
    if (currentUserId && groupLeaderId && currentUserId === groupLeaderId) {
      return true;
    }

    // Fallback pencocokan Email jika ID bernilai undefined
    if (currentUser.email && group.members) {
      const leaderMember = group.members.find((m) => Number(m.id) === groupLeaderId);
      if (leaderMember && leaderMember.email === currentUser.email) {
        return true;
      }
    }

    return false;
  });

  // 4. Cek apakah user saat ini adalah Anggota Biasa (bukan Ketua) di kelompok ini
  let isRegularMember = $derived.by(() => {
    if (!group || !group.members || isLeader || !currentUser) return false;
    const currentUserId = Number(currentUser.id || currentUser.userId);

    return group.members.some((m) => {
      const matchId = currentUserId && Number(m.id) === currentUserId;
      const matchEmail = currentUser.email && m.email === currentUser.email;
      return matchId || matchEmail;
    });
  });

  $effect(() => {
    if (groupId) {
      loadDetail(groupId);
      loadGroupFarmlands(groupId);
    }
  });

  async function loadDetail(id: string) {
    isLoading = true;
    errorMessage = '';
    try {
      const data = await getFarmerGroupById(id);
      group = data;
      isPending = data.isPending === true;
      applicationStatus = data.applicationStatus || null;
    } catch (err: any) {
      errorMessage = err.message || 'Gagal memuat detail kelompok tani.';
    } finally {
      isLoading = false;
    }
  }

  // Fetch Lahan Kelompok Tani
  async function loadGroupFarmlands(id: string) {
    isLoadingFarmlands = true;
    try {
      const data = await getGroupFarmlands(id);
      groupFarmlands = data;
    } catch (err) {
      console.error('Gagal memuat lahan kelompok tani:', err);
      groupFarmlands = [];
    } finally {
      isLoadingFarmlands = false;
    }
  }

  async function handleApply() {
    if (!groupId) return;
    isApplying = true;
    try {
      await applyToFarmerGroup(groupId);
      isPending = true;
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mengajukan bergabung.', { title: 'Pengajuan gagal', tone: 'error' });
    } finally {
      isApplying = false;
    }
  }

  // Handler Keluar Kelompok Tani (Khusus Anggota Biasa)
  async function handleLeaveGroup() {
    if (!await showConfirm('Anda akan keluar dari kelompok tani ini.', { title: 'Keluar dari kelompok?', confirmLabel: 'Ya, keluar' })) return;

    isLeaving = true;
    try {
      await leaveFarmerGroup();
      await showAlert('Anda berhasil keluar dari kelompok tani.', { title: 'Berhasil', tone: 'success' });
      window.location.href = '/kelompok-tani';
    } catch (err: any) {
      await showAlert(err.message || 'Terjadi kesalahan saat keluar.', { title: 'Tidak bisa keluar', tone: 'error' });
    } finally {
      isLeaving = false;
    }
  }

  // --- LEADER ACTIONS ---

  // 1. Keluarkan Anggota
  async function handleRemoveMember(memberId: number) {
    if (!await showConfirm('Anggota ini akan dikeluarkan dari kelompok tani.', { title: 'Keluarkan anggota?', confirmLabel: 'Ya, keluarkan' })) return;
    actionLoadingId = memberId;
    try {
      await removeGroupMember(memberId);
      await loadDetail(groupId!);
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mengeluarkan anggota.', { title: 'Aksi gagal', tone: 'error' });
    } finally {
      actionLoadingId = null;
    }
  }

  // 2. Tambah Anggota Manual via ID
  async function handleAddMember() {
    const userIdInput = await showInput({
      title: 'Tambahkan anggota',
      message: 'Masukkan ID pengguna yang akan ditambahkan ke kelompok tani.',
      input: { label: 'User ID anggota', type: 'number', min: 1, step: 1, placeholder: 'Contoh: 12', required: true },
      confirmLabel: 'Tambah anggota',
    });
    if (userIdInput === null) return;
    const userId = Number(userIdInput);
    if (!Number.isInteger(userId) || userId < 1) {
      await showAlert('User ID harus berupa bilangan bulat positif.', { title: 'ID tidak valid', tone: 'error' });
      return;
    }

    isAddingMember = true;
    try {
      await addGroupMember(userId);
      await showAlert('Anggota berhasil ditambahkan.', { title: 'Berhasil', tone: 'success' });
      await loadDetail(groupId!);
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menambahkan anggota.', { title: 'Tidak bisa menambahkan anggota', tone: 'error' });
    } finally {
      isAddingMember = false;
    }
  }

  // 3. Load & Buka Popup Persetujuan Anggota Pending
  async function openPendingModal() {
    showPendingModal = true;
    isLoadingPending = true;
    try {
      const data = await getPendingMembers();
      pendingList = data;
    } catch (err: any) {
      await showAlert(err.message || 'Gagal memuat calon anggota.', { title: 'Tidak bisa memuat data', tone: 'error' });
    } finally {
      isLoadingPending = false;
    }
  }

  // 4. Approve Member
  async function handleApprove(memberId: number) {
    actionLoadingId = memberId;
    try {
      await approveMember(memberId);
      pendingList = pendingList.filter((m) => m.id !== memberId);
      await loadDetail(groupId!);
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menyetujui anggota.', { title: 'Aksi gagal', tone: 'error' });
    } finally {
      actionLoadingId = null;
    }
  }

  // 5. Reject Member
  async function handleReject(memberId: number) {
    actionLoadingId = memberId;
    try {
      await rejectMember(memberId);
      pendingList = pendingList.filter((m) => m.id !== memberId);
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menolak anggota.', { title: 'Aksi gagal', tone: 'error' });
    } finally {
      actionLoadingId = null;
    }
  }
</script>

<svelte:head>
  <title>{group ? group.name : 'Detail Kelompok Tani'} | Tani Siaga</title>
</svelte:head>

<div class="min-h-screen bg-dark-bg text-text-primary p-4 sm:p-6 lg:p-8 font-sans">
  <div class="max-w-4xl mx-auto space-y-6">

    <a href="/kelompok-tani" class="inline-flex items-center text-xs text-brand-accent hover:underline gap-1">
      &larr; Kembali ke Daftar Kelompok Tani
    </a>

    {#if isLoading}
      <div class="bg-dark-surface border border-brand-primary/30 p-8 rounded-2xl animate-pulse space-y-4">
        <div class="h-8 bg-brand-primary/30 rounded w-1/2"></div>
        <div class="h-4 bg-brand-primary/20 rounded w-1/4"></div>
        <div class="h-20 bg-brand-primary/20 rounded w-full"></div>
      </div>
    {:else if errorMessage}
      <div class="bg-dark-surface border border-status-danger/40 p-8 rounded-2xl text-center space-y-3">
        <p class="text-status-danger text-sm">⚠️ {errorMessage}</p>
        <a href="/kelompok-tani" class="inline-block text-xs bg-brand-primary px-4 py-2 rounded-lg text-text-primary">
          Kembali
        </a>
      </div>
    {:else if group}
      <div class="bg-dark-surface border border-brand-primary/40 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">

        <!-- Header Detail & Action Buttons -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-primary/30 pb-6">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl sm:text-3xl font-bold text-text-primary">{group.name}</h1>
              {#if isLeader}
                <span class="bg-brand-secondary/20 text-brand-secondary text-xs px-2.5 py-1 rounded-md font-semibold border border-brand-secondary/40">
                  Ketua (Anda)
                </span>
              {/if}
            </div>
            <p class="text-xs text-brand-accent mt-1">
              ID Poktan: {group.poktan_id || 'Belum Terverifikasi'}
            </p>
          </div>

          <!-- Pilihan Tombol Tergantung Role (Leader, Regular Member, or Common User) -->
          {#if isLeader}
            <div class="flex flex-wrap gap-2">
              <button
                onclick={openPendingModal}
                class="bg-status-warning/20 border border-status-warning/50 text-status-warning hover:bg-status-warning/30 text-xs font-semibold px-3 py-2.5 rounded-xl transition flex items-center gap-1.5"
              >
                <span>⏳ Menunggu Persetujuan Ketua</span>
              </button>

              <button
                onclick={handleAddMember}
                class="bg-brand-secondary hover:bg-brand-secondary/90 text-text-primary text-xs font-semibold px-3.5 py-2.5 rounded-xl transition"
              >
                ➕ Tambahkan Anggota
              </button>
            </div>
          {:else if isRegularMember}
            <button
              onclick={handleLeaveGroup}
              disabled={isLeaving}
              class="btn-leave-top"
            >
              {isLeaving ? 'Memproses...' : '🚪 Keluar Kelompok'}
            </button>
          {:else if isPending}
            <span class="bg-status-warning/15 border border-status-warning/40 text-status-warning font-semibold text-xs px-4 py-2.5 rounded-xl self-start sm:self-auto">
              ⏳ Menunggu Respon
            </span>
          {:else}
            <button
              onclick={handleApply}
              disabled={isApplying}
              class="bg-brand-secondary hover:bg-brand-secondary/90 text-text-primary font-semibold text-xs px-5 py-2.5 rounded-xl transition disabled:opacity-50 self-start sm:self-auto"
            >
              {isApplying ? 'Mengajukan...' : applicationStatus === 'rejected' ? 'Ajukan Bergabung Kembali' : 'Ajukan Bergabung'}
            </button>
          {/if}
        </div>

        <!-- Info Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-dark-bg border border-brand-primary/30 p-4 rounded-xl">
            <span class="text-text-secondary text-xs block">Ketua Kelompok</span>
            <span class="text-text-primary font-semibold text-sm mt-0.5 block truncate">
              ✉️ {leaderEmail}
            </span>
          </div>

          <div class="bg-dark-bg border border-brand-primary/30 p-4 rounded-xl">
            <span class="text-text-secondary text-xs block">Jumlah Anggota</span>
            <span class="text-text-primary font-semibold text-sm mt-0.5 block">
              👥 {group.members?.length || 0} Anggota
            </span>
          </div>
        </div>

        <!-- Alamat / Deskripsi -->
        {#if group.address}
          <div>
            <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Alamat</h3>
            <p class="text-text-primary text-sm leading-relaxed">{group.address}</p>
          </div>
        {/if}

        <div>
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Deskripsi Kelompok</h3>
          <p class="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
            {group.description || 'Belum ada deskripsi yang ditambahkan untuk kelompok tani ini.'}
          </p>
        </div>

        <!-- DAFTAR ANGGOTA -->
        <div class="pt-4 border-t border-brand-primary/20 space-y-3">
          <h3 class="text-sm font-semibold text-text-primary">Daftar Anggota</h3>

          {#if !group.members || group.members.length === 0}
            <p class="text-text-secondary text-xs italic">Belum ada anggota di kelompok ini.</p>
          {:else}
            <div class="max-h-60 overflow-y-auto border border-brand-primary/30 rounded-xl p-3 bg-dark-bg/60 space-y-2 pr-1 custom-scrollbar">
              {#each group.members as member (member.id)}
                <div class="bg-dark-surface border border-brand-primary/20 p-3 rounded-lg flex items-center justify-between gap-3">
                  
                  <div class="flex items-center gap-3 min-w-0">
                    <!-- Tombol mengeluarkan HANYA MUNCUL jika isLeader = true DAN anggota yang ditunjuk BUKAN ketua -->
                    {#if isLeader && Number(member.id) !== Number(group.group_leader_id)}
                      <button
                        onclick={() => handleRemoveMember(member.id)}
                        disabled={actionLoadingId === member.id}
                        class="bg-status-danger/20 hover:bg-status-danger/40 border border-status-danger/40 text-status-danger text-[11px] font-semibold px-2.5 py-1 rounded-md transition shrink-0 disabled:opacity-50"
                      >
                        {actionLoadingId === member.id ? '...' : 'Keluarkan'}
                      </button>
                    {/if}

                    <div class="truncate">
                      <p class="text-xs font-medium text-text-primary truncate">{member.email}</p>
                      <span class="text-[10px] text-text-secondary capitalize">{member.role?.replace('_', ' ') || 'member'}</span>
                    </div>
                  </div>

                  {#if Number(member.id) === Number(group.group_leader_id)}
                    <span class="bg-brand-secondary/20 text-brand-secondary text-[10px] px-2 py-0.5 rounded font-semibold border border-brand-secondary/30 shrink-0">
                      Ketua
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- SECTION LAHAN KELOMPOK TANI -->
        <div class="farmland-section">
          <h3>🌾 Lahan Kelompok Tani</h3>

          {#if isLoadingFarmlands}
            <p class="status-text">Memuat daftar lahan...</p>
          {:else if groupFarmlands.length === 0}
            <p class="status-text">Belum ada lahan yang terdaftar pada kelompok tani ini.</p>
          {:else}
            <div class="farmland-grid">
              {#each groupFarmlands as item (item.id)}
                <div class="farmland-card">
                  <h4>{item.name || 'Lahan Tani'}</h4>
                  <p><strong>Pemilik:</strong> {item.user?.email || '-'}</p>
                  <p><strong>Komoditas:</strong> {item.commodity?.name || '-'}</p>
                  <p><strong>Luas Area:</strong> {item.area_size || '-'} m²</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      </div>
    {/if}

  </div>
</div>

<!-- ================= POPUP / MODAL: DAFTAR MENUNGGU PERSETUJUAN ================= -->
{#if showPendingModal}
  <div class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <h3>⏳ Menunggu Persetujuan Ketua</h3>
        <button type="button" class="close-btn" onclick={() => (showPendingModal = false)}>✕</button>
      </div>

      <div class="modal-body">
        {#if isLoadingPending}
          <div class="loading-state">Memuat calon anggota...</div>
        {:else if pendingList.length === 0}
          <div class="empty-state">Tidak ada calon anggota yang menunggu persetujuan.</div>
        {:else}
          <div class="pending-list">
            {#each pendingList as pendingMember (pendingMember.id)}
              <div class="pending-item">
                <div class="member-info">
                  <p class="member-email">{pendingMember.email}</p>
                  <span class="member-id">ID: {pendingMember.id}</span>
                </div>

                <div class="action-buttons">
                  <button
                    type="button"
                    class="btn-approve"
                    onclick={() => handleApprove(pendingMember.id)}
                    disabled={actionLoadingId === pendingMember.id}
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    class="btn-reject"
                    onclick={() => handleReject(pendingMember.id)}
                    disabled={actionLoadingId === pendingMember.id}
                  >
                    Reject
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-close" onclick={() => (showPendingModal = false)}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

<!-- ================= STYLES (CSS MURNI) ================= -->
<style>
  /* Tombol Keluar Kelompok Tani pada Header */
  .btn-leave-top {
    background-color: rgba(211, 47, 47, 0.2);
    color: #ef5350;
    border: 1px solid #d32f2f;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .btn-leave-top:hover {
    background-color: rgba(211, 47, 47, 0.4);
  }

  .btn-leave-top:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Section Lahan Kelompok Tani */
  .farmland-section {
    margin-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 20px;
  }

  .farmland-section h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 14px;
    color: #ffffff;
  }

  .farmland-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .farmland-card {
    background-color: #121212;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 12px 14px;
  }

  .farmland-card h4 {
    margin: 0 0 6px 0;
    font-size: 14px;
    color: #4caf50;
  }

  .farmland-card p {
    margin: 4px 0;
    font-size: 12px;
    color: #cccccc;
  }

  .status-text {
    font-size: 13px;
    color: #888888;
    font-style: italic;
  }

  /* Overlay Hitam Memblokir Seluruh Layar */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 16px;
    box-sizing: border-box;
  }

  /* Kotak Pop-up Modal */
  .modal-card {
    background-color: #1e1e1e;
    color: #ffffff;
    border: 1px solid #333333;
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #333333;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: #aaaaaa;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
  }

  .close-btn:hover {
    color: #ffffff;
  }

  .modal-body {
    padding: 20px;
    max-height: 350px;
    overflow-y: auto;
  }

  .loading-state,
  .empty-state {
    text-align: center;
    color: #aaaaaa;
    font-size: 13px;
    padding: 20px 0;
  }

  .pending-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .pending-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #121212;
    border: 1px solid #2a2a2a;
    padding: 12px 14px;
    border-radius: 8px;
    gap: 12px;
  }

  .member-info {
    display: flex;
    flex-direction: column;
    text-align: left;
    overflow: hidden;
  }

  .member-email {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-id {
    font-size: 11px;
    color: #888888;
    margin-top: 2px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-approve {
    background-color: #2e7d32;
    color: #ffffff;
    border: none;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-approve:hover {
    background-color: #1b5e20;
  }

  .btn-reject {
    background-color: rgba(211, 47, 47, 0.2);
    color: #ef5350;
    border: 1px solid #d32f2f;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-reject:hover {
    background-color: rgba(211, 47, 47, 0.4);
  }

  .btn-approve:disabled,
  .btn-reject:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 20px;
    border-top: 1px solid #333333;
    background-color: #1a1a1a;
  }

  .btn-close {
    background-color: #2a2a2a;
    color: #ffffff;
    border: 1px solid #444444;
    padding: 8px 16px;
    font-size: 12px;
    border-radius: 8px;
    cursor: pointer;
  }

  .btn-close:hover {
    background-color: #333333;
  }

</style>