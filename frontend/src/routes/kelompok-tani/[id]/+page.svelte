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

<main class="page-shell">
  <div class="page-container">
    <a href="/kelompok-tani" class="back-link">← Kembali ke Daftar Kelompok Tani</a>

    {#if isLoading}
      <div class="state loading-card" aria-label="Memuat detail kelompok tani">
        <span></span><span></span><span></span>
      </div>
    {:else if errorMessage}
      <div class="state error-state" role="alert">
        <p>{errorMessage}</p>
        <a href="/kelompok-tani" class="secondary-button">Kembali ke daftar</a>
      </div>
    {:else if group}
      <article class="detail-card">
        <header class="detail-heading">
          <div class="group-identity">
            <p class="eyebrow">KELOMPOK TANI</p>
            <div class="title-row">
              <h1>{group.name}</h1>
              {#if isLeader}<span class="leader-badge">Ketua (Anda)</span>{/if}
            </div>
            <p class="group-code">ID Poktan · {group.poktan_id || 'Belum terverifikasi'}</p>
          </div>

          {#if isLeader}
            <div class="header-actions">
              <button type="button" class="warning-button" onclick={openPendingModal}>Menunggu persetujuan</button>
              <button type="button" class="primary-button" onclick={handleAddMember}>+ Tambahkan anggota</button>
            </div>
          {:else if isRegularMember}
            <button type="button" class="danger-button" onclick={handleLeaveGroup} disabled={isLeaving}>
              {isLeaving ? 'Memproses...' : 'Keluar kelompok'}
            </button>
          {:else if isPending}
            <span class="pending-badge">Menunggu respons</span>
          {:else}
            <button type="button" class="primary-button" onclick={handleApply} disabled={isApplying}>
              {isApplying ? 'Mengajukan...' : applicationStatus === 'rejected' ? 'Ajukan bergabung kembali' : 'Ajukan bergabung'}
            </button>
          {/if}
        </header>

        <div class="info-grid">
          <div class="info-item"><span>Ketua kelompok</span><strong>{leaderEmail}</strong></div>
          <div class="info-item"><span>Jumlah anggota</span><strong>{group.members?.length || 0} anggota</strong></div>
        </div>

        {#if group.address}
          <section class="text-section">
            <h2>Alamat</h2>
            <p>{group.address}</p>
          </section>
        {/if}

        <section class="text-section">
          <h2>Deskripsi kelompok</h2>
          <p>{group.description || 'Belum ada deskripsi yang ditambahkan untuk kelompok tani ini.'}</p>
        </section>

        <section class="members-section">
          <div class="section-heading"><h2>Daftar anggota</h2><span>{group.members?.length || 0} anggota</span></div>
          {#if !group.members || group.members.length === 0}
            <p class="status-text">Belum ada anggota di kelompok ini.</p>
          {:else}
            <div class="member-list">
              {#each group.members as member (member.id)}
                <div class="member-row">
                  <div class="member-info">
                    <p class="member-email">{member.email}</p>
                    <span class="member-role">{member.role?.replace('_', ' ') || 'member'}</span>
                  </div>
                  <div class="member-actions">
                    {#if isLeader && Number(member.id) !== Number(group.group_leader_id)}
                      <button type="button" class="remove-button" onclick={() => handleRemoveMember(member.id)} disabled={actionLoadingId === member.id}>
                        {actionLoadingId === member.id ? '...' : 'Keluarkan'}
                      </button>
                    {/if}
                    {#if Number(member.id) === Number(group.group_leader_id)}<span class="leader-badge">Ketua</span>{/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <section class="farmland-section">
          <div class="section-heading"><h2>Lahan kelompok tani</h2><span>{groupFarmlands.length} lahan</span></div>
          {#if isLoadingFarmlands}
            <p class="status-text">Memuat daftar lahan...</p>
          {:else if groupFarmlands.length === 0}
            <p class="status-text">Belum ada lahan yang terdaftar pada kelompok tani ini.</p>
          {:else}
            <div class="farmland-grid">
              {#each groupFarmlands as item (item.id)}
                <article class="farmland-card">
                  <h3>{item.name || 'Lahan Tani'}</h3>
                  <p><strong>Pemilik</strong><span>{item.user?.email || '-'}</span></p>
                  <p><strong>Komoditas</strong><span>{item.commodity?.name || '-'}</span></p>
                  <p><strong>Luas area</strong><span>{item.area_size || '-'} m²</span></p>
                </article>
              {/each}
            </div>
          {/if}
        </section>
      </article>
    {/if}
  </div>
</main>

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

<style>
  .page-shell { min-height: 100vh; box-sizing: border-box; background: #f4f7f1; color: #183126; padding: 36px 20px 68px; }
  .page-container { width: min(100%, 1000px); margin: 0 auto; }
  .back-link { display: inline-block; margin-bottom: 24px; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
  .back-link:hover { text-decoration: underline; }
  .detail-card, .state { border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; box-shadow: 0 8px 22px #23472e0f; }
  .detail-card { display: grid; gap: 24px; padding: 28px; }
  .detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 1px solid #e8eee6; padding-bottom: 22px; }
  .group-identity { min-width: 0; }
  .eyebrow { margin: 0 0 8px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
  .title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
  h1 { margin: 0; color: #183126; font: 600 clamp(30px, 4vw, 42px)/1.08 'Fraunces', Georgia, serif; overflow-wrap: anywhere; }
  .group-code { margin: 9px 0 0; color: #4e805a; font-size: 12px; }
  .header-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  .primary-button, .secondary-button, .warning-button, .danger-button, .remove-button, .btn-approve, .btn-reject, .btn-close { display: inline-flex; align-items: center; justify-content: center; min-height: 38px; border: 1px solid transparent; border-radius: 7px; padding: 8px 12px; font: inherit; font-size: 12px; font-weight: 700; line-height: 1.25; text-decoration: none; cursor: pointer; transition: background-color .18s, border-color .18s, opacity .18s; }
  .primary-button { border-color: #39754b; background: #39754b; color: #fff; }
  .primary-button:hover:not(:disabled) { border-color: #2d603c; background: #2d603c; }
  .secondary-button { border-color: #39754b; background: #fff; color: #39754b; }
  .secondary-button:hover { background: #f4faf2; }
  .warning-button, .pending-badge { border-color: #e6d4a9; background: #fff8e7; color: #946b26; }
  .danger-button, .remove-button { border-color: #edc9c6; background: #fff0ef; color: #a44242; }
  .danger-button:hover:not(:disabled), .remove-button:hover:not(:disabled), .btn-reject:hover:not(:disabled) { background: #ffe4e1; }
  button:disabled { cursor: not-allowed; opacity: .6; }
  button:focus-visible, .secondary-button:focus-visible { outline: 3px solid #5c95684d; outline-offset: 2px; }
  .leader-badge, .pending-badge { display: inline-flex; align-items: center; flex: 0 0 auto; border: 1px solid #d6e8d5; border-radius: 999px; background: #eaf4e9; color: #39754b; padding: 5px 9px; font-size: 11px; font-weight: 700; }
  .pending-badge { border-color: #e6d4a9; background: #fff8e7; color: #946b26; }
  .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .info-item { display: grid; gap: 6px; min-width: 0; border: 1px solid #d6e1d5; border-radius: 8px; background: #f9fbf8; padding: 14px; }
  .info-item span, .section-heading > span { color: #718077; font-size: 12px; }
  .info-item strong { overflow: hidden; color: #274a32; font-size: 13px; text-overflow: ellipsis; }
  .text-section { display: grid; gap: 7px; }
  .text-section h2, .section-heading h2 { margin: 0; color: #183126; font-size: 17px; }
  .text-section p { margin: 0; color: #718077; font-size: 13px; line-height: 1.65; white-space: pre-line; }
  .members-section, .farmland-section { border-top: 1px solid #e8eee6; padding-top: 20px; }
  .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
  .member-list { display: grid; max-height: 300px; gap: 8px; overflow-y: auto; padding-right: 3px; }
  .member-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid #e1e9df; border-radius: 8px; background: #fbfdfb; padding: 11px 13px; }
  .member-info { display: grid; min-width: 0; gap: 4px; }
  .member-email { margin: 0; overflow: hidden; color: #274a32; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .member-role { color: #718077; font-size: 11px; text-transform: capitalize; }
  .member-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
  .remove-button { min-height: 30px; padding: 5px 9px; font-size: 11px; }
  .status-text { margin: 0; color: #718077; font-size: 13px; }
  .farmland-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 11px; }
  .farmland-card { border: 1px solid #d6e1d5; border-radius: 8px; background: #f9fbf8; padding: 14px; }
  .farmland-card h3 { margin: 0 0 12px; color: #274a32; font-size: 15px; overflow-wrap: anywhere; }
  .farmland-card p { display: flex; justify-content: space-between; gap: 10px; margin: 7px 0 0; color: #718077; font-size: 11px; }
  .farmland-card p strong { color: #385540; font-weight: 700; }
  .farmland-card p span { text-align: right; overflow-wrap: anywhere; }
  .state { padding: 30px; }
  .loading-card { display: grid; gap: 14px; min-height: 150px; }
  .loading-card span { height: 14px; border-radius: 4px; background: #e8eee6; animation: pulse 1.3s ease-in-out infinite alternate; }
  .loading-card span:first-child { width: 55%; height: 23px; }.loading-card span:last-child { width: 80%; }
  .error-state { display: grid; justify-items: center; gap: 14px; text-align: center; }
  .error-state p { margin: 0; color: #a44242; font-size: 14px; }
  .modal-overlay { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: #18312680; backdrop-filter: blur(3px); padding: 16px; }
  .modal-card { display: flex; width: min(100%, 480px); max-height: min(600px, 90vh); flex-direction: column; overflow: hidden; border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; color: #183126; box-shadow: 0 18px 50px #18312630; }
  .modal-header, .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; }
  .modal-header { border-bottom: 1px solid #e8eee6; }
  .modal-header h3 { margin: 0; color: #183126; font-size: 16px; }
  .close-btn { border: 0; background: transparent; color: #718077; padding: 3px 7px; font-size: 18px; cursor: pointer; }
  .close-btn:hover { color: #183126; }
  .modal-body { overflow-y: auto; padding: 16px 18px; }
  .loading-state, .empty-state { padding: 22px 0; color: #718077; font-size: 13px; text-align: center; }
  .pending-list { display: grid; gap: 8px; }
  .pending-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid #e1e9df; border-radius: 8px; background: #fbfdfb; padding: 11px; }
  .member-id { color: #718077; font-size: 11px; }
  .action-buttons { display: flex; flex: 0 0 auto; gap: 7px; }
  .btn-approve { border-color: #39754b; background: #39754b; color: #fff; }
  .btn-approve:hover:not(:disabled) { background: #2d603c; }
  .btn-reject { border-color: #edc9c6; background: #fff0ef; color: #a44242; }
  .modal-footer { justify-content: flex-end; border-top: 1px solid #e8eee6; background: #f9fbf8; }
  .btn-close { border-color: #d6e1d5; background: #fff; color: #385540; }
  .btn-close:hover { background: #f4f7f1; }
  @keyframes pulse { to { opacity: .55; } }
  @media (max-width: 700px) { .detail-heading { align-items: flex-start; flex-direction: column; }.header-actions { justify-content: flex-start; }.detail-heading > button, .header-actions > button { width: 100%; }.info-grid { grid-template-columns: 1fr; } }
  @media (max-width: 560px) { .page-shell { padding: 28px 14px 54px; }.detail-card { gap: 20px; padding: 20px 16px; }.state { padding: 22px 16px; }.title-row { align-items: flex-start; flex-direction: column; gap: 8px; }.member-row, .pending-item { align-items: flex-start; }.member-actions { flex-direction: column-reverse; align-items: flex-end; }.farmland-card p { align-items: flex-start; flex-direction: column; gap: 3px; }.farmland-card p span { text-align: left; }.action-buttons { flex-direction: column; } }
  @media (prefers-reduced-motion: reduce) { .loading-card span { animation: none; } }
</style>