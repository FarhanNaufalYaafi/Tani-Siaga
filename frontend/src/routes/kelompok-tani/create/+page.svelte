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

<main class="page-shell">
  <div class="page-container">
    <a href="/kelompok-tani" class="back-link">← Kembali ke Daftar Kelompok Tani</a>
    <header class="page-heading">
      <p class="eyebrow">KOLABORASI PETANI</p>
      <h1>Buat Kelompok Tani Baru</h1>
      <p class="subtitle">Isi formulir di bawah ini untuk membentuk ruang kolaborasi bagi kelompok tani Anda.</p>
    </header>

    {#if errorMessage}
      <div class="alert" role="alert">{errorMessage}</div>
    {/if}

    <form onsubmit={handleSubmit} class="form-card">
      <label for="name">
        Nama Poktan <span class="required">*</span>
        <input id="name" type="text" maxlength="150" bind:value={name} placeholder="Contoh: Poktan Suka Maju" required />
        <small>{name.length}/150 karakter</small>
      </label>

      <label for="poktan_id">
        Nomor Registrasi Poktan <span class="optional">Opsional</span>
        <input id="poktan_id" type="text" maxlength="50" bind:value={poktan_id} placeholder="Contoh: PKT-12345678" />
        <small>{poktan_id.length}/50 karakter</small>
      </label>

      <label for="address">
        Alamat Lengkap <span class="optional">Opsional</span>
        <textarea id="address" rows="4" bind:value={address} placeholder="Contoh: Jl. Tani Desa Makmur RT 02/05, Kabupaten..."></textarea>
      </label>

      <div class="form-actions">
        <a href="/kelompok-tani">Batal</a>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : 'Buat Kelompok Tani'}
        </button>
      </div>
    </form>
  </div>
</main>

<style>
  .page-shell { min-height: 100vh; box-sizing: border-box; background: #f4f7f1; color: #183126; padding: 36px 20px 68px; }
  .page-container { width: min(100%, 760px); margin: 0 auto; }
  .back-link { display: inline-block; margin-bottom: 30px; color: #39754b; font-size: 13px; font-weight: 700; text-decoration: none; }
  .back-link:hover { text-decoration: underline; }
  .page-heading { margin-bottom: 25px; }
  .eyebrow { margin: 0 0 9px; color: #4e805a; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
  h1 { margin: 0; font: 600 clamp(34px, 5vw, 46px)/1.08 'Fraunces', Georgia, serif; }
  .subtitle { margin: 12px 0 0; color: #718077; font-size: 14px; line-height: 1.6; }
  .form-card { display: grid; gap: 20px; border: 1px solid #d6e1d5; border-radius: 10px; background: #fff; padding: 28px; box-shadow: 0 8px 22px #23472e0f; }
  label { display: grid; gap: 8px; color: #385540; font-size: 13px; font-weight: 700; }
  input, textarea { box-sizing: border-box; width: 100%; border: 1px solid #d6e1d5; border-radius: 7px; background: #fbfdfb; color: #183126; padding: 12px 13px; font: inherit; font-size: 14px; font-weight: 400; outline: 0; }
  input:focus, textarea:focus { border-color: #5c9568; box-shadow: 0 0 0 3px #5c95681c; }
  textarea { resize: vertical; }
  label small { justify-self: end; color: #718077; font-size: 11px; font-weight: 400; }
  .required { color: #a44242; }
  .optional { color: #718077; font-size: 11px; font-weight: 500; }
  .form-actions { display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #e8eee6; padding-top: 18px; }
  .form-actions a, .form-actions button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border: 1px solid #39754b; border-radius: 7px; padding: 9px 15px; font: inherit; font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; transition: background-color .18s, border-color .18s, opacity .18s; }
  .form-actions a { background: #fff; color: #39754b; }
  .form-actions a:hover { background: #f4faf2; }
  .form-actions button { background: #39754b; color: #fff; }
  .form-actions button:hover:not(:disabled) { border-color: #2d603c; background: #2d603c; }
  .form-actions button:disabled { cursor: wait; opacity: .65; }
  .form-actions a:focus-visible, .form-actions button:focus-visible { outline: 3px solid #5c95684d; outline-offset: 2px; }
  .alert { margin-bottom: 18px; border: 1px solid #edc9c6; border-radius: 8px; background: #fff0ef; padding: 12px 14px; color: #a44242; font-size: 13px; }
  @media (max-width: 560px) { .page-shell { padding: 28px 14px 54px; }.form-card { padding: 20px 17px; }.form-actions { flex-direction: column-reverse; }.form-actions a, .form-actions button { width: 100%; box-sizing: border-box; } }
</style>