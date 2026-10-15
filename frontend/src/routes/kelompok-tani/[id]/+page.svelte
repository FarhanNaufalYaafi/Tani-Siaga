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

<main class="kerangka-halaman">
  <div class="wadah-halaman">
    <a href="/kelompok-tani" class="tautan-kembali">← Kembali ke Daftar Kelompok Tani</a>

    {#if isLoading}
      <div class="keadaan kartu-memuat" aria-label="Memuat detail kelompok tani">
        <span></span><span></span><span></span>
      </div>
    {:else if errorMessage}
      <div class="keadaan keadaan-galat" role="alert">
        <p>{errorMessage}</p>
        <a href="/kelompok-tani" class="tombol-pendukung">Kembali ke daftar</a>
      </div>
    {:else if group}
      <article class="kartu-rincian">
        <header class="judul-rincian">
          <div class="identitas-kelompok">
            <p class="label-kecil">KELOMPOK TANI</p>
            <div class="baris-judul">
              <h1 class="judul">{group.name}</h1>
              {#if isLeader}<span class="lencana-pemimpin">Ketua (Anda)</span>{/if}
            </div>
            <p class="kode-kelompok">ID Poktan · {group.poktan_id || 'Belum terverifikasi'}</p>
          </div>

          {#if isLeader}
            <div class="aksi-bilah">
              <button type="button" class="tombol-peringatan" onclick={openPendingModal}>Menunggu persetujuan</button>
              <button type="button" class="tombol-utama" onclick={handleAddMember}>+ Tambahkan anggota</button>
            </div>
          {:else if currentUser?.role === 'admin'}
            <span class="lencana-pemimpin">Admin</span>
          {:else if isRegularMember}
            <button type="button" class="tombol-bahaya" onclick={handleLeaveGroup} disabled={isLeaving}>
              {isLeaving ? 'Memproses...' : 'Keluar kelompok'}
            </button>
          {:else if isPending}
            <span class="lencana-menunggu">Menunggu respons</span>
          {:else}
            <button type="button" class="tombol-utama" onclick={handleApply} disabled={isApplying}>
              {isApplying ? 'Mengajukan...' : applicationStatus === 'rejected' ? 'Ajukan bergabung kembali' : 'Ajukan bergabung'}
            </button>
          {/if}
        </header>

        <div class="kisi-informasi">
          <div class="butir-informasi"><span>Ketua kelompok</span><strong>{leaderEmail}</strong></div>
          <div class="butir-informasi"><span>Jumlah anggota</span><strong>{group.members?.length || 0} anggota</strong></div>
        </div>

        {#if group.address}
          <section class="bagian-teks">
            <h2>Alamat</h2>
            <p>{group.address}</p>
          </section>
        {/if}

        <section class="bagian-teks">
          <h2>Deskripsi kelompok</h2>
          <p>{group.description || 'Belum ada deskripsi yang ditambahkan untuk kelompok tani ini.'}</p>
        </section>

        <section class="bagian-anggota">
          <div class="judul-bagian"><h2>Daftar anggota</h2><span>{group.members?.length || 0} anggota</span></div>
          {#if !group.members || group.members.length === 0}
            <p class="teks-status">Belum ada anggota di kelompok ini.</p>
          {:else}
            <div class="daftar-anggota">
              {#each group.members as member (member.id)}
                <div class="baris-anggota">
                  <div class="informasi-anggota">
                    <p class="email-anggota">{member.email}</p>
                    <span class="peran-anggota">{member.role?.replace('_', ' ') || 'member'}</span>
                  </div>
                  <div class="aksi-anggota">
                    {#if isLeader && Number(member.id) !== Number(group.group_leader_id)}
                      <button type="button" class="tombol-hapus" onclick={() => handleRemoveMember(member.id)} disabled={actionLoadingId === member.id}>
                        {actionLoadingId === member.id ? '...' : 'Keluarkan'}
                      </button>
                    {/if}
                    {#if Number(member.id) === Number(group.group_leader_id)}<span class="lencana-pemimpin">Ketua</span>{/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <section class="bagian-lahan">
          <div class="judul-bagian"><h2>Lahan kelompok tani</h2><span>{groupFarmlands.length} lahan</span></div>
          {#if isLoadingFarmlands}
            <p class="teks-status">Memuat daftar lahan...</p>
          {:else if groupFarmlands.length === 0}
            <p class="teks-status">Belum ada lahan yang terdaftar pada kelompok tani ini.</p>
          {:else}
            <div class="kisi-lahan">
              {#each groupFarmlands as item (item.id)}
                <article class="kartu-lahan">
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
  <div class="lapisan-dialog">
    <div class="kartu-dialog">
      <div class="bilah-dialog">
        <h3>⏳ Menunggu Persetujuan Ketua</h3>
        <button type="button" class="tombol-tutup" onclick={() => (showPendingModal = false)}>✕</button>
      </div>

      <div class="isi-dialog">
        {#if isLoadingPending}
          <div class="keadaan-memuat">Memuat calon anggota...</div>
        {:else if pendingList.length === 0}
          <div class="keadaan-kosong">Tidak ada calon anggota yang menunggu persetujuan.</div>
        {:else}
          <div class="daftar-menunggu">
            {#each pendingList as pendingMember (pendingMember.id)}
              <div class="butir-menunggu">
                <div class="informasi-anggota">
                  <p class="email-anggota">{pendingMember.email}</p>
                  <span class="id-anggota">ID: {pendingMember.id}</span>
                </div>

                <div class="tombol-aksi">
                  <button
                    type="button"
                    class="setujui-tombol"
                    onclick={() => handleApprove(pendingMember.id)}
                    disabled={actionLoadingId === pendingMember.id}
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    class="tolak-tombol"
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

      <div class="kaki-halaman-dialog">
        <button type="button" class="tutup-tombol" onclick={() => (showPendingModal = false)}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

<style>
	.kerangka-halaman {
		min-height: 100vh;
		box-sizing: border-box;
		background: #f4f7f1;
		color: #183126;
		padding: 36px 20px 68px;
	}
	.wadah-halaman {
		width: min(100%, 1000px);
		margin: 0 auto;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 24px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.tautan-kembali:hover {
		text-decoration: underline;
	}
	.kartu-rincian, .keadaan {
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e0f;
	}
	.kartu-rincian {
		display: grid;
		gap: 24px;
		padding: 28px;
	}
	.judul-rincian {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		border-bottom: 1px solid #e8eee6;
		padding-bottom: 22px;
	}
	.identitas-kelompok {
		min-width: 0;
	}
	.label-kecil {
		margin: 0 0 8px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	.baris-judul {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
	}
	h1 {
		margin: 0;
		color: #183126;
		font: 600 clamp(30px, 4vw, 42px)/1.08 'Fraunces', Georgia, serif;
		overflow-wrap: anywhere;
	}
	.kode-kelompok {
		margin: 9px 0 0;
		color: #4e805a;
		font-size: 12px;
	}
	.aksi-bilah {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
	}
	.tombol-utama, .tombol-pendukung, .tombol-peringatan, .tombol-bahaya, .tombol-hapus, .setujui-tombol, .tolak-tombol, .tutup-tombol {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 38px;
		border: 1px solid transparent;
		border-radius: 7px;
		padding: 8px 12px;
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		line-height: 1.25;
		text-decoration: none;
		cursor: pointer;
		transition: background-color .18s, border-color .18s, opacity .18s;
	}
	.tombol-utama {
		border-color: #39754b;
		background: #39754b;
		color: #fff;
	}
	.tombol-utama:hover:not(:disabled) {
		border-color: #2d603c;
		background: #2d603c;
	}
	.tombol-pendukung {
		border-color: #39754b;
		background: #fff;
		color: #39754b;
	}
	.tombol-pendukung:hover {
		background: #f4faf2;
	}
	.tombol-peringatan, .lencana-menunggu {
		border-color: #e6d4a9;
		background: #fff8e7;
		color: #946b26;
	}
	.tombol-bahaya, .tombol-hapus {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	.tombol-bahaya:hover:not(:disabled), .tombol-hapus:hover:not(:disabled), .tolak-tombol:hover:not(:disabled) {
		background: #ffe4e1;
	}
	button:disabled {
		cursor: not-allowed;
		opacity: .6;
	}
	button:focus-visible, .tombol-pendukung:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 2px;
	}
	.lencana-pemimpin, .lencana-menunggu {
		display: inline-flex;
		align-items: center;
		flex: 0 0 auto;
		border: 1px solid #d6e8d5;
		border-radius: 999px;
		background: #eaf4e9;
		color: #39754b;
		padding: 5px 9px;
		font-size: 11px;
		font-weight: 700;
	}
	.lencana-menunggu {
		border-color: #e6d4a9;
		background: #fff8e7;
		color: #946b26;
	}
	.kisi-informasi {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.butir-informasi {
		display: grid;
		gap: 6px;
		min-width: 0;
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #f9fbf8;
		padding: 14px;
	}
	.butir-informasi span, .judul-bagian > span {
		color: #718077;
		font-size: 12px;
	}
	.butir-informasi strong {
		overflow: hidden;
		color: #274a32;
		font-size: 13px;
		text-overflow: ellipsis;
	}
	.bagian-teks {
		display: grid;
		gap: 7px;
	}
	.bagian-teks h2, .judul-bagian h2 {
		margin: 0;
		color: #183126;
		font-size: 17px;
	}
	.bagian-teks p {
		margin: 0;
		color: #718077;
		font-size: 13px;
		line-height: 1.65;
		white-space: pre-line;
	}
	.bagian-anggota, .bagian-lahan {
		border-top: 1px solid #e8eee6;
		padding-top: 20px;
	}
	.judul-bagian {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 13px;
	}
	.daftar-anggota {
		display: grid;
		max-height: 300px;
		gap: 8px;
		overflow-y: auto;
		padding-right: 3px;
	}
	.baris-anggota {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border: 1px solid #e1e9df;
		border-radius: 8px;
		background: #fbfdfb;
		padding: 11px 13px;
	}
	.informasi-anggota {
		display: grid;
		min-width: 0;
		gap: 4px;
	}
	.email-anggota {
		margin: 0;
		overflow: hidden;
		color: #274a32;
		font-size: 13px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.peran-anggota {
		color: #718077;
		font-size: 11px;
		text-transform: capitalize;
	}
	.aksi-anggota {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 0 0 auto;
	}
	.tombol-hapus {
		min-height: 30px;
		padding: 5px 9px;
		font-size: 11px;
	}
	.teks-status {
		margin: 0;
		color: #718077;
		font-size: 13px;
	}
	.kisi-lahan {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
		gap: 11px;
	}
	.kartu-lahan {
		border: 1px solid #d6e1d5;
		border-radius: 8px;
		background: #f9fbf8;
		padding: 14px;
	}
	.kartu-lahan h3 {
		margin: 0 0 12px;
		color: #274a32;
		font-size: 15px;
		overflow-wrap: anywhere;
	}
	.kartu-lahan p {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		margin: 7px 0 0;
		color: #718077;
		font-size: 11px;
	}
	.kartu-lahan p strong {
		color: #385540;
		font-weight: 700;
	}
	.kartu-lahan p span {
		text-align: right;
		overflow-wrap: anywhere;
	}
	.keadaan {
		padding: 30px;
	}
	.kartu-memuat {
		display: grid;
		gap: 14px;
		min-height: 150px;
	}
	.kartu-memuat span {
		height: 14px;
		border-radius: 4px;
		background: #e8eee6;
		animation: denyut 1.3s ease-in-out infinite alternate;
	}
	.kartu-memuat span:first-child {
		width: 55%;
		height: 23px;
	}
	.kartu-memuat span:last-child {
		width: 80%;
	}
	.keadaan-galat {
		display: grid;
		justify-items: center;
		gap: 14px;
		text-align: center;
	}
	.keadaan-galat p {
		margin: 0;
		color: #a44242;
		font-size: 14px;
	}
	.lapisan-dialog {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		background: #18312680;
		backdrop-filter: blur(3px);
		padding: 16px;
	}
	.kartu-dialog {
		display: flex;
		width: min(100%, 480px);
		max-height: min(600px, 90vh);
		flex-direction: column;
		overflow: hidden;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		color: #183126;
		box-shadow: 0 18px 50px #18312630;
	}
	.bilah-dialog, .kaki-halaman-dialog {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 15px 18px;
	}
	.bilah-dialog {
		border-bottom: 1px solid #e8eee6;
	}
	.bilah-dialog h3 {
		margin: 0;
		color: #183126;
		font-size: 16px;
	}
	.tombol-tutup {
		border: 0;
		background: transparent;
		color: #718077;
		padding: 3px 7px;
		font-size: 18px;
		cursor: pointer;
	}
	.tombol-tutup:hover {
		color: #183126;
	}
	.isi-dialog {
		overflow-y: auto;
		padding: 16px 18px;
	}
	.keadaan-memuat, .keadaan-kosong {
		padding: 22px 0;
		color: #718077;
		font-size: 13px;
		text-align: center;
	}
	.daftar-menunggu {
		display: grid;
		gap: 8px;
	}
	.butir-menunggu {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border: 1px solid #e1e9df;
		border-radius: 8px;
		background: #fbfdfb;
		padding: 11px;
	}
	.id-anggota {
		color: #718077;
		font-size: 11px;
	}
	.tombol-aksi {
		display: flex;
		flex: 0 0 auto;
		gap: 7px;
	}
	.setujui-tombol {
		border-color: #39754b;
		background: #39754b;
		color: #fff;
	}
	.setujui-tombol:hover:not(:disabled) {
		background: #2d603c;
	}
	.tolak-tombol {
		border-color: #edc9c6;
		background: #fff0ef;
		color: #a44242;
	}
	.kaki-halaman-dialog {
		justify-content: flex-end;
		border-top: 1px solid #e8eee6;
		background: #f9fbf8;
	}
	.tutup-tombol {
		border-color: #d6e1d5;
		background: #fff;
		color: #385540;
	}
	.tutup-tombol:hover {
		background: #f4f7f1;
	}
	@keyframes denyut {
		to {
			opacity: .55;
		}
	}
	@media (max-width: 700px) {
		.judul-rincian {
			align-items: flex-start;
			flex-direction: column;
		}
		.aksi-bilah {
			justify-content: flex-start;
		}
		.judul-rincian > button, .aksi-bilah > button {
			width: 100%;
		}
		.kisi-informasi {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.kerangka-halaman {
			padding: 28px 14px 54px;
		}
		.kartu-rincian {
			gap: 20px;
			padding: 20px 16px;
		}
		.keadaan {
			padding: 22px 16px;
		}
		.baris-judul {
			align-items: flex-start;
			flex-direction: column;
			gap: 8px;
		}
		.baris-anggota, .butir-menunggu {
			align-items: flex-start;
		}
		.aksi-anggota {
			flex-direction: column-reverse;
			align-items: flex-end;
		}
		.kartu-lahan p {
			align-items: flex-start;
			flex-direction: column;
			gap: 3px;
		}
		.kartu-lahan p span {
			text-align: left;
		}
		.tombol-aksi {
			flex-direction: column;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kartu-memuat span {
			animation: none;
		}
	}
</style>