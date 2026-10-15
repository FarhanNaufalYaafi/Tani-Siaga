<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getNotification, markNotificationRead, type AppNotification } from '$lib/api/notification-api';

  let notification = $state<AppNotification | null>(null);
  let errorMessage = $state('');

  onMount(async () => {
    try {
      const id = $page.params.id;
      if (!id) throw new Error('Notifikasi tidak ditemukan.');
      notification = await markNotificationRead(id);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Gagal memuat detail notifikasi.';
    }
  });

  async function openTarget() {
    if (notification?.targetUrl) await goto(notification.targetUrl);
  }
</script>

<svelte:head><title>{notification?.title || 'Detail Notifikasi'} | Tani Siaga</title></svelte:head>

<section class="halaman-rincian">
  {#if errorMessage}<p class="galat">{errorMessage}</p>
  {:else if !notification}<p class="keadaan">Memuat detail...</p>
  {:else}
    <a class="kembali" href="/notifikasi">← Kembali ke notifikasi</a>
    <article class="kartu-rincian" data-tingkat-keparahan={notification.severity}>
      <span class="label-kecil">{notification.type.replaceAll('_', ' ')}</span>
      <h1 class="judul">{notification.title}</h1>
      <p class="pesan">{notification.message}</p>
      {#if notification.targetUrl}<button class="tombol-sasaran" onclick={openTarget}>Lihat halaman terkait ↗</button>{/if}
    </article>
  {/if}
</section>

<style>
	.halaman-rincian {
		width: min(100% - 40px, 820px);
		margin: 0 auto;
		padding: 70px 0 100px;
		color: #183126;
	}
	.kembali {
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.kartu-rincian {
		margin-top: 24px;
		border: 1px solid #a9c9aa;
		border-left: 8px solid #6eaa78;
		border-radius: 10px;
		background: #fff;
		padding: 34px;
	}
	.kartu-rincian[data-tingkat-keparahan='warning'] {
		border-left-color: #e3ad4e;
	}
	.kartu-rincian[data-tingkat-keparahan='danger'] {
		border-left-color: #c9514b;
	}
	.label-kecil {
		color: #39754b;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
		text-transform: uppercase;
	}
	.kartu-rincian h1 {
		margin: 12px 0;
		font: 600 42px/1.05 'Fraunces', Georgia, serif;
	}
	.pesan {
		color: #52705a;
		font-size: 16px;
		line-height: 1.7;
	}
	.tombol-sasaran {
		margin-top: 20px;
		border: 0;
		border-radius: 7px;
		background: #39754b;
		color: #fff;
		padding: 12px 16px;
		font-weight: 700;
		cursor: pointer;
	}
	.galat {
		color: #c9514b;
	}
	@media (max-width: 560px) {
		.halaman-rincian {
			width: min(100% - 28px, 820px);
			padding-top: 40px;
		}
		.kartu-rincian {
			padding: 24px;
		}
		.kartu-rincian h1 {
			font-size: 34px;
		}
	}
</style>
