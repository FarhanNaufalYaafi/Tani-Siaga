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
</script>

<svelte:head><title>Notifikasi | Tani Siaga</title></svelte:head>

<section class="notification-page">
  <div class="page-heading">
    <span class="eyebrow">Pusat informasi</span>
    <h1>Notifikasi</h1>
    <p>Ringkasan kabar penting tentang lahan, pasar, kelompok tani, dan pesananmu.</p>
  </div>

  {#if isLoading}<p class="state">Memuat notifikasi...</p>
  {:else if errorMessage}<div class="state error"><p>{errorMessage}</p><button class="action-button" type="button" onclick={() => void loadNotifications()}>Coba lagi</button></div>
  {:else}
    {#if notice}<p class="feedback success" role="status">{notice}</p>{/if}
    {#if actionError}<p class="feedback error" role="alert">{actionError}</p>{/if}
    {#if notifications.length === 0}<p class="state">Belum ada notifikasi.</p>
    {:else}
      <div class="notification-toolbar">
        <p>{notifications.length} notifikasi · {unreadCount} belum dibaca</p>
        <div class="bulk-actions">
          <button class="action-button" type="button" onclick={markAllRead} disabled={unreadCount === 0 || isMarkingAllRead || isDeletingAll || pendingNotificationId !== null}>{isMarkingAllRead ? 'Menandai...' : 'Tandai semua dibaca'}</button>
          <button class="action-button danger" type="button" onclick={removeAllNotifications} disabled={isMarkingAllRead || isDeletingAll || pendingNotificationId !== null}>{isDeletingAll ? 'Menghapus...' : 'Hapus semua'}</button>
        </div>
      </div>
      <div class="notification-list">
        {#each notifications as notification (notification.id)}
          <article class:unread={!notification.isRead} class="notification-card">
            <span class={`severity ${notification.severity}`}></span>
            <div class="notification-copy">
              <a class="notification-open" href={`/notifikasi/${notification.id}`}>
                <div class="notification-meta"><span>{notification.type.replaceAll('_', ' ')}</span><time>{formatDate(notification.createdAt)}</time></div>
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
              </a>
              <div class="notification-actions">
                {#if notification.isRead}<span class="read-status">Sudah dibaca</span>
                {:else}<button class="action-button" type="button" onclick={() => markRead(notification)} disabled={pendingNotificationId === notification.id || isMarkingAllRead || isDeletingAll}>{pendingNotificationId === notification.id && pendingNotificationAction === 'read' ? 'Menandai...' : 'Tandai dibaca'}</button>{/if}
                <button class="action-button danger" type="button" onclick={() => removeNotification(notification)} disabled={pendingNotificationId === notification.id || isMarkingAllRead || isDeletingAll}>{pendingNotificationId === notification.id && pendingNotificationAction === 'delete' ? 'Menghapus...' : 'Hapus'}</button>
              </div>
            </div>
            <a class="arrow" aria-label={`Buka notifikasi: ${notification.title}`} href={`/notifikasi/${notification.id}`}>↗</a>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .notification-page { width: min(100% - 40px, 940px); margin: 0 auto; padding: 70px 0 100px; color: #183126; }
  .page-heading { margin-bottom: 28px; }
  .eyebrow { color: #39754b; font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
  h1 { margin: 10px 0 8px; font: 600 clamp(40px, 6vw, 64px)/1 'Fraunces', Georgia, serif; }
  .page-heading p, .state { color: #718077; line-height: 1.6; }
  .notification-list { display: grid; gap: 12px; }
  .notification-card { display: grid; grid-template-columns: 9px 1fr auto; gap: 16px; align-items: center; border: 1px solid #cbd6cc; border-radius: 10px; background: #e8eee8; padding: 18px 20px; color: #52635a; text-decoration: none; transition: transform .2s, box-shadow .2s, background-color .2s, border-color .2s; }
  .notification-card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px #23472e12; }
  .notification-card.unread { border-color: #8ab58d; background: #fff; color: #183126; box-shadow: 0 4px 14px #23472e0c; }
  .notification-card.unread h2 { color: #183126; font-weight: 800; }
  .notification-card:not(.unread) h2 { color: #52635a; font-weight: 600; }
  .severity { width: 8px; height: 52px; border-radius: 99px; background: #6eaa78; }
  .severity.warning { background: #e3ad4e; }.severity.danger { background: #c9514b; }
  .notification-meta { display: flex; justify-content: space-between; gap: 12px; color: #65746a; font-size: 11px; text-transform: capitalize; }.notification-meta time { text-transform: none; }
  .notification-card.unread .notification-meta { color: #5d6d61; }
  h2 { margin: 7px 0 4px; font-size: 17px; }.notification-copy p { margin: 0; color: #65746a; font-size: 13px; line-height: 1.45; }.notification-card.unread .notification-copy p { color: #4f6255; }.arrow { color: #39754b; font-size: 22px; }
  .notification-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; color: #65746a; font-size: 13px; }.notification-toolbar p { margin: 0; }.bulk-actions, .notification-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }.notification-actions { margin-top: 14px; }
  .action-button { min-height: 36px; border: 1px solid #39754b; border-radius: 7px; background: #39754b; color: #fff; padding: 8px 11px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; transition: background-color .18s, border-color .18s, opacity .18s; }.action-button:hover:not(:disabled) { border-color: #2d603c; background: #2d603c; }.action-button.danger { border-color: #e3c5c2; background: #fff; color: #a44242; }.action-button.danger:hover:not(:disabled) { border-color: #c9514b; background: #fff0ef; }.action-button:focus-visible { outline: 3px solid #5c95684d; outline-offset: 2px; }.action-button:disabled { cursor: not-allowed; opacity: .55; }
  .notification-open { display: block; color: inherit; text-decoration: none; }.notification-open:hover h2 { color: #39754b; }.notification-actions .read-status { color: #718077; font-size: 12px; }.feedback { margin: 0 0 14px; padding: 11px 13px; border-radius: 7px; font-size: 13px; }.feedback.success { background: #edf8ed; color: #39754b; }.feedback.error, .state.error { color: #c9514b; }.state.error p { margin: 0 0 10px; }
  @media (max-width: 560px) { .notification-page { width: min(100% - 28px, 940px); padding-top: 40px; }.page-header { align-items: flex-start; flex-direction: column; }.notification-toolbar { align-items: stretch; flex-direction: column; }.bulk-actions { display: grid; grid-template-columns: 1fr 1fr; }.bulk-actions .action-button { padding-inline: 8px; }.notification-card { grid-template-columns: 7px 1fr; align-items: start; }.arrow { display: none; }.notification-meta { display: block; }.notification-meta time { display: block; margin-top: 4px; }.notification-actions { margin-top: 12px; } }
</style>
