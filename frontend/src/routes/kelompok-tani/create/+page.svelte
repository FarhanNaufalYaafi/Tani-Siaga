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

<main class="kerangka-halaman">
  <div class="wadah-halaman">
    <a href="/kelompok-tani" class="tautan-kembali">← Kembali ke Daftar Kelompok Tani</a>
    <header class="judul-halaman">
      <p class="label-kecil">KOLABORASI PETANI</p>
      <h1 class="judul">Buat Kelompok Tani Baru</h1>
      <p class="subjudul">Isi formulir di bawah ini untuk membentuk ruang kolaborasi bagi kelompok tani Anda.</p>
    </header>

    {#if errorMessage}
      <div class="peringatan" role="alert">{errorMessage}</div>
    {/if}

    <form onsubmit={handleSubmit} class="kartu-formulir">
      <label for="nama">
        Nama Poktan <span class="wajib">*</span>
        <input id="nama" type="text" maxlength="150" bind:value={name} placeholder="Contoh: Poktan Suka Maju" required />
        <small>{name.length}/150 karakter</small>
      </label>

      <label for="id-kelompok-tani">
        Nomor Registrasi Poktan <span class="opsional">Opsional</span>
        <input id="id-kelompok-tani" type="text" maxlength="50" bind:value={poktan_id} placeholder="Contoh: PKT-12345678" />
        <small>{poktan_id.length}/50 karakter</small>
      </label>

      <label for="alamat">
        Alamat Lengkap <span class="opsional">Opsional</span>
        <textarea id="alamat" rows="4" bind:value={address} placeholder="Contoh: Jl. Tani Desa Makmur RT 02/05, Kabupaten..."></textarea>
      </label>

      <div class="aksi-formulir">
        <a href="/kelompok-tani">Batal</a>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : 'Buat Kelompok Tani'}
        </button>
      </div>
    </form>
  </div>
</main>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		box-sizing: border-box;
		background: #f4f7f1;
		color: #183126;
		padding: 36px 20px 68px;
	}
	.wadah-halaman {
		width: min(100%, 760px);
		margin: 0 auto;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 30px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.tautan-kembali:hover {
		text-decoration: underline;
	}
	.judul-halaman {
		margin-bottom: 25px;
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
		font: 600 clamp(34px, 5vw, 46px)/1.08 'Fraunces', Georgia, serif;
	}
	.subjudul {
		margin: 12px 0 0;
		color: #718077;
		font-size: 14px;
		line-height: 1.6;
	}
	.kartu-formulir {
		display: grid;
		gap: 20px;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		padding: 28px;
		box-shadow: 0 8px 22px #23472e0f;
	}
	label {
		display: grid;
		gap: 8px;
		color: #385540;
		font-size: 13px;
		font-weight: 700;
	}
	input, textarea {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fbfdfb;
		color: #183126;
		padding: 12px 13px;
		font: inherit;
		font-size: 14px;
		font-weight: 400;
		outline: 0;
	}
	input:focus, textarea:focus {
		border-color: #5c9568;
		box-shadow: 0 0 0 3px #5c95681c;
	}
	textarea {
		resize: vertical;
	}
	label small {
		justify-self: end;
		color: #718077;
		font-size: 11px;
		font-weight: 400;
	}
	.wajib {
		color: #a44242;
	}
	.opsional {
		color: #718077;
		font-size: 11px;
		font-weight: 500;
	}
	.aksi-formulir {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		border-top: 1px solid #e8eee6;
		padding-top: 18px;
	}
	.aksi-formulir a, .aksi-formulir button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 40px;
		border: 1px solid #39754b;
		border-radius: 7px;
		padding: 9px 15px;
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		transition: background-color .18s, border-color .18s, opacity .18s;
	}
	.aksi-formulir a {
		background: #fff;
		color: #39754b;
	}
	.aksi-formulir a:hover {
		background: #f4faf2;
	}
	.aksi-formulir button {
		background: #39754b;
		color: #fff;
	}
	.aksi-formulir button:hover:not(:disabled) {
		border-color: #2d603c;
		background: #2d603c;
	}
	.aksi-formulir button:disabled {
		cursor: wait;
		opacity: .65;
	}
	.aksi-formulir a:focus-visible, .aksi-formulir button:focus-visible {
		outline: 3px solid #5c95684d;
		outline-offset: 2px;
	}
	.peringatan {
		margin-bottom: 18px;
		border: 1px solid #edc9c6;
		border-radius: 8px;
		background: #fff0ef;
		padding: 12px 14px;
		color: #a44242;
		font-size: 13px;
	}
	@media (max-width: 560px) {
		.kerangka-halaman {
			padding: 28px 14px 54px;
		}
		.kartu-formulir {
			padding: 20px 17px;
		}
		.aksi-formulir {
			flex-direction: column-reverse;
		}
		.aksi-formulir a, .aksi-formulir button {
			width: 100%;
			box-sizing: border-box;
		}
	}
</style>