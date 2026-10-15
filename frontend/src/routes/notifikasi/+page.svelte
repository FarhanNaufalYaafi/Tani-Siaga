<script lang="ts">
  import { onMount } from 'svelte';
  import { deleteAllNotifications, deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '$lib/api/notification-api';
  import { showConfirm } from '$lib/services/dialog';

  let notifications = $state<AppNotification[]>([]);
  let unreadCount = $state(0);
  let isLoading = $state(true);
  let errorMessage = $state('');
  let actionError = $state('');
  let notice = $state('');
  let pendingNotificationId = $state<number | null>(null);
  let pendingNotificationAction = $state<'read' | 'delete' | null>(null);
  let isMarkingAllRead = $state(false);
  let isDeletingAll = $state(false);

  onMount(() => {
    void loadNotifications();
  });

  async function loadNotifications() {
    isLoading = true;
    errorMessage = '';
    try {
      const result = await getNotifications();
      notifications = result.data;
      unreadCount = result.unreadCount;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Gagal memuat notifikasi.';
    } finally {
      isLoading = false;
    }
  }

  async function markRead(notification: AppNotification) {
    if (notification.isRead || pendingNotificationId !== null) return;
    pendingNotificationId = notification.id;
    pendingNotificationAction = 'read';
    actionError = '';
    notice = '';
    try {
      await markNotificationRead(notification.id);
      notifications = notifications.map((item) => item.id === notification.id ? { ...item, isRead: true } : item);
      unreadCount = Math.max(0, unreadCount - 1);
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Gagal menandai notifikasi.';
    } finally {
      pendingNotificationId = null;
      pendingNotificationAction = null;
    }
  }

  async function markAllRead() {
    if (unreadCount === 0 || isMarkingAllRead || isDeletingAll || pendingNotificationId !== null) return;
    isMarkingAllRead = true;
    actionError = '';
    notice = '';
    try {
      await markAllNotificationsRead();
      notifications = notifications.map((item) => ({ ...item, isRead: true }));
      unreadCount = 0;
      notice = 'Semua notifikasi sudah ditandai dibaca.';
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Gagal menandai semua notifikasi.';
    } finally {
      isMarkingAllRead = false;
    }
  }

  async function removeNotification(notification: AppNotification) {
    if (pendingNotificationId !== null || isMarkingAllRead || isDeletingAll) return;
    const confirmed = await showConfirm(`Notifikasi "${notification.title}" akan dihapus permanen.`, {
      title: 'Hapus notifikasi?',
      confirmLabel: 'Hapus',
      tone: 'error'
    });
    if (!confirmed) return;

    pendingNotificationId = notification.id;
    pendingNotificationAction = 'delete';
    actionError = '';
    notice = '';
    try {
      await deleteNotification(notification.id);
      notifications = notifications.filter((item) => item.id !== notification.id);
      if (!notification.isRead) unreadCount = Math.max(0, unreadCount - 1);
      notice = 'Notifikasi berhasil dihapus.';
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Gagal menghapus notifikasi.';
    } finally {
      pendingNotificationId = null;
      pendingNotificationAction = null;
    }
  }

  async function removeAllNotifications() {
    if (notifications.length === 0 || isMarkingAllRead || isDeletingAll || pendingNotificationId !== null) return;
    const confirmed = await showConfirm(`Semua ${notifications.length} notifikasi akan dihapus permanen.`, {
      title: 'Hapus semua notifikasi?',
      confirmLabel: 'Hapus semua',
      tone: 'error'
    });
    if (!confirmed) return;

    isDeletingAll = true;
    actionError = '';
    notice = '';
    try {
      await deleteAllNotifications();
      notifications = [];
      unreadCount = 0;
      notice = 'Semua notifikasi berhasil dihapus.';
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Gagal menghapus semua notifikasi.';
    } finally {
      isDeletingAll = false;
    }
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function notificationSeverity(notification: AppNotification) {
    if (notification.type === 'shop_approval' && notification.title === 'Toko dibubarkan admin') return 'danger';
    return notification.severity;
  }
</script>

<svelte:head><title>Notifikasi | Tani Siaga</title></svelte:head>

<section class="halaman-notifikasi">
  <div class="judul-halaman">
    <span class="label-kecil">Pusat informasi</span>
    <h1 class="judul">Notifikasi</h1>
    <p>Ringkasan kabar penting tentang lahan, pasar, kelompok tani, dan pesananmu.</p>
  </div>

  {#if isLoading}<p class="keadaan">Memuat notifikasi...</p>
  {:else if errorMessage}<div class="keadaan galat"><p>{errorMessage}</p><button class="tombol-aksi" type="button" onclick={() => void loadNotifications()}>Coba lagi</button></div>
  {:else}
    {#if notice}<p class="masukan berhasil" role="status">{notice}</p>{/if}
    {#if actionError}<p class="masukan galat" role="alert">{actionError}</p>{/if}
    {#if notifications.length === 0}<p class="keadaan">Belum ada notifikasi.</p>
    {:else}
      <div class="bilah-notifikasi">
        <p>{notifications.length} notifikasi · {unreadCount} belum dibaca</p>
        <div class="aksi-massal">
          <button class="tombol-aksi" type="button" onclick={markAllRead} disabled={unreadCount === 0 || isMarkingAllRead || isDeletingAll || pendingNotificationId !== null}>{isMarkingAllRead ? 'Menandai...' : 'Tandai semua dibaca'}</button>
          <button class="tombol-aksi bahaya" type="button" onclick={removeAllNotifications} disabled={isMarkingAllRead || isDeletingAll || pendingNotificationId !== null}>{isDeletingAll ? 'Menghapus...' : 'Hapus semua'}</button>
        </div>
      </div>
      <div class="daftar-notifikasi">
        {#each notifications as notification (notification.id)}
          <article class:belum={!notification.isRead} class="kartu-notifikasi">
            <span class="tingkat-keparahan" data-tingkat-keparahan={notificationSeverity(notification)}></span>
            <div class="teks-notifikasi">
              <a class="buka-notifikasi" href={`/notifikasi/${notification.id}`}>
                <div class="informasi-notifikasi"><span>{notification.type.replaceAll('_', ' ')}</span><time>{formatDate(notification.createdAt)}</time></div>
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
              </a>
              <div class="aksi-notifikasi">
                {#if notification.isRead}<span class="status-baca">Sudah dibaca</span>
                {:else}<button class="tombol-aksi" type="button" onclick={() => markRead(notification)} disabled={pendingNotificationId === notification.id || isMarkingAllRead || isDeletingAll}>{pendingNotificationId === notification.id && pendingNotificationAction === 'read' ? 'Menandai...' : 'Tandai dibaca'}</button>{/if}
                <button class="tombol-aksi bahaya" type="button" onclick={() => removeNotification(notification)} disabled={pendingNotificationId === notification.id || isMarkingAllRead || isDeletingAll}>{pendingNotificationId === notification.id && pendingNotificationAction === 'delete' ? 'Menghapus...' : 'Hapus'}</button>
              </div>
            </div>
            <a class="panah" aria-label={`Buka notifikasi: ${notification.title}`} href={`/notifikasi/${notification.id}`}>↗</a>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
	.halaman-notifikasi {
		width: min(100% - 40px, 940px);
		margin: 0 auto;
		padding: 70px 0 100px;
		color: #183126;
	}
	.judul-halaman {
		margin-bottom: 28px;
	}
	.label-kecil {
		color: #39754b;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .15em;
		text-transform: uppercase;
	}
	h1 {
		margin: 10px 0 8px;
		font: 600 clamp(40px, 6vw, 64px)/1 'Fraunces', Georgia, serif;
	}
	.judul-halaman p, .keadaan {
		color: #718077;
		line-height: 1.6;
	}
	.daftar-notifikasi {
		display: grid;
		gap: 12px;
	}
	.kartu-notifikasi {
		display: grid;
		grid-template-columns: 9px 1fr auto;
		gap: 16px;
		align-items: center;
		border: 1px solid #cbd6cc;
		border-radius: 10px;
		background: #e8eee8;
		padding: 18px 20px;
		color: #52635a;
		text-decoration: none;
		transition: transform .2s, box-shadow .2s, background-color .2s, border-color .2s;
	}
	.kartu-notifikasi:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 25px #23472e12;
	}
	.kartu-notifikasi.belum {
		border-color: #8ab58d;
		background: #fff;
		color: #183126;
		box-shadow: 0 4px 14px #23472e0c;
	}
	.kartu-notifikasi.belum h2 {
		color: #183126;
		font-weight: 800;
	}
	.kartu-notifikasi:not(.belum) h2 {
		color: #52635a;
		font-weight: 600;
	}
	.tingkat-keparahan {
		width: 8px;
		height: 52px;
		border-radius: 99px;
		background: #6eaa78;
	}
	.tingkat-keparahan[data-tingkat-keparahan='warning'] {
		background: #e3ad4e;
	}
	.tingkat-keparahan[data-tingkat-keparahan='danger'] {
		background: #c9514b;
	}
	.informasi-notifikasi {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		color: #65746a;
		font-size: 11px;
		text-transform: capitalize;
	}
	.informasi-notifikasi time {
		text-transform: none;
	}
	.kartu-notifikasi.belum .informasi-notifikasi {
		color: #5d6d61;
	}
	h2 {
		margin: 7px 0 4px;
		font-size: 17px;
	}
	.teks-notifikasi p {
		margin: 0;
		color: #65746a;
		font-size: 13px;
		line-height: 1.45;
	}
	.kartu-notifikasi.belum .teks-notifikasi p {
		color: #4f6255;
	}
	.panah {
		color: #39754b;
		font-size: 22px;
	}
	.bilah-notifikasi {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
		color: #65746a;
		font-size: 13px;
	}
	.bilah-notifikasi p {
		margin: 0;
	}
	.aksi-massal, .aksi-notifikasi {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.aksi-notifikasi {
		margin-top: 14px;
	}
	.tombol-aksi {
		min-height: 36px;
		border: 1px solid #39754b;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 8px 11px;
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: background-color .18s, border-color .18s, opacity .18s;
	}
	.tombol-aksi:hover:not(:disabled) {
		border-color: #2d603c;
		background: #2d603c;
	}
	.tombol-aksi.bahaya {
		border-color: #e3c5c2;
		background: #fff;
		color: #a44242;
	}
	.tombol-aksi.bahaya:hover:not(:disabled) {
		border-color: #c9514b;
		background: #fff0ef;
	}
	.tombol-aksi:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 2px;
	}
	.tombol-aksi:disabled {
		cursor: not-allowed;
		opacity: .55;
	}
	.buka-notifikasi {
		display: block;
		color: inherit;
		text-decoration: none;
	}
	.buka-notifikasi:hover h2 {
		color: #39754b;
	}
	.aksi-notifikasi .status-baca {
		color: #718077;
		font-size: 12px;
	}
	.masukan {
		margin: 0 0 14px;
		padding: 11px 13px;
		border-radius: 7px;
		font-size: 13px;
	}
	.masukan.berhasil {
		background: #edf8ed;
		color: #39754b;
	}
	.masukan.galat, .keadaan.galat {
		color: #c9514b;
	}
	.keadaan.galat p {
		margin: 0 0 10px;
	}
	@media (max-width: 560px) {
		.halaman-notifikasi {
			width: min(100% - 28px, 940px);
			padding-top: 40px;
		}
		.bilah-notifikasi {
			align-items: flex-start;
			flex-direction: column;
		}
		.bilah-notifikasi {
			align-items: stretch;
			flex-direction: column;
		}
		.aksi-massal {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
		.aksi-massal .tombol-aksi {
			padding-inline: 8px;
		}
		.kartu-notifikasi {
			grid-template-columns: 7px 1fr;
			align-items: start;
		}
		.panah {
			display: none;
		}
		.informasi-notifikasi {
			display: block;
		}
		.informasi-notifikasi time {
			display: block;
			margin-top: 4px;
		}
		.aksi-notifikasi {
			margin-top: 12px;
		}
	}
</style>
