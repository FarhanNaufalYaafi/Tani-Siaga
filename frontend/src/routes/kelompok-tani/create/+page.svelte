<script lang="ts">
  import { createFarmerGroup } from '$lib/api/farmer-group-api';
  import { goto } from '$app/navigation';

  let name = $state('');
  let poktan_id = $state('');
  let address = $state('');

  let isSubmitting = $state(false);
  let errorMessage = $state('');

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    errorMessage = '';

    if (!name.trim()) {
      errorMessage = 'Nama Poktan tidak boleh kosong';
      return;
    }

    if (name.length > 150) {
      errorMessage = 'Nama Poktan maksimal 150 karakter';
      return;
    }

    if (poktan_id && poktan_id.length > 50) {
      errorMessage = 'Nomor registrasi Poktan maksimal 50 karakter';
      return;
    }

    isSubmitting = true;

    try {
      const response = await createFarmerGroup({
        name: name.trim(),
        poktan_id: poktan_id.trim() || undefined,
        address: address.trim() || undefined
      });

      // Redirect langsung ke detail kelompok tani yang baru dibuat
      if (response?.data?.id) {
        goto(`/kelompok-tani/${response.data.id}`);
      } else {
        goto('/kelompok-tani');
      }
    } catch (err: any) {
      errorMessage = err.message || 'Gagal membuat kelompok tani.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Buat Kelompok Tani | Tani Siaga</title>
</svelte:head>

<div class="min-h-screen bg-dark-bg text-text-primary p-4 sm:p-6 lg:p-8 font-sans">
  <div class="max-w-2xl mx-auto space-y-6">

    <a href="/kelompok-tani" class="inline-flex items-center text-xs text-brand-accent hover:underline gap-1">
      &larr; Kembali ke Daftar Kelompok Tani
    </a>

    <div class="bg-dark-surface border border-brand-primary/40 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">➕ Buat Kelompok Tani Baru</h1>
        <p class="text-xs text-text-secondary mt-1">
          Isi formulir di bawah ini untuk mengandalkan kelompok tani baru Anda.
        </p>
      </div>

      {#if errorMessage}
        <div class="p-4 rounded-xl bg-status-danger/15 border border-status-danger/30 text-status-danger text-sm">
          ⚠️ {errorMessage}
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="space-y-4">
        <!-- Nama Poktan -->
        <div>
          <label for="name" class="block text-xs font-semibold text-text-primary mb-1">
            Nama Poktan <span class="text-status-danger">*</span>
          </label>
          <input
            id="name"
            type="text"
            maxlength="150"
            bind:value={name}
            placeholder="Contoh: Poktan Suka Maju"
            required
            class="w-full bg-dark-bg border border-brand-primary/30 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-accent transition"
          />
          <span class="text-[10px] text-text-secondary float-right mt-1">{name.length}/150</span>
        </div>

        <!-- Nomor Registrasi / Poktan ID -->
        <div>
          <label for="poktan_id" class="block text-xs font-semibold text-text-primary mb-1">
            Nomor Registrasi Poktan <span class="text-text-secondary font-normal">(Opsional)</span>
          </label>
          <input
            id="poktan_id"
            type="text"
            maxlength="50"
            bind:value={poktan_id}
            placeholder="Contoh: PKT-12345678"
            class="w-full bg-dark-bg border border-brand-primary/30 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-accent transition"
          />
          <span class="text-[10px] text-text-secondary float-right mt-1">{poktan_id.length}/50</span>
        </div>

        <!-- Alamat -->
        <div>
          <label for="address" class="block text-xs font-semibold text-text-primary mb-1">
            Alamat Lengkap <span class="text-text-secondary font-normal">(Opsional)</span>
          </label>
          <textarea
            id="address"
            rows="3"
            bind:value={address}
            placeholder="Contoh: Jl. Tani Desa Makmur RT 02/05, Kabupaten..."
            class="w-full bg-dark-bg border border-brand-primary/30 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-accent transition"
          ></textarea>
        </div>

        <div class="pt-4 border-t border-brand-primary/20 flex gap-3">
          <a
            href="/kelompok-tani"
            class="w-1/2 text-center bg-dark-bg border border-brand-primary/30 hover:bg-brand-primary/20 text-text-primary text-xs font-medium py-3 rounded-xl transition"
          >
            Batal
          </a>

          <button
            type="submit"
            disabled={isSubmitting}
            class="w-1/2 bg-brand-secondary hover:bg-brand-secondary/90 text-text-primary text-xs font-semibold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {#if isSubmitting}
              <div class="w-4 h-4 border-2 border-text-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Menyimpan...</span>
            {:else}
              <span>Buat Kelompok Tani</span>
            {/if}
          </button>
        </div>
      </form>
    </div>

  </div>
</div>