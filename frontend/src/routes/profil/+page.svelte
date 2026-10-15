<script lang="ts">
	import { onDestroy } from 'svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { changeProfilePassword, getCurrentUser, requestProfilePasswordCode, signoutApi, updateCurrentUser, type CurrentUserDto } from '$lib/api/auth-api';
	import { isStrongPassword, PASSWORD_REQUIREMENTS } from '$lib/services/password-validation';
	import { uploadImage } from '$lib/api/media-api';

	let user = $state<CurrentUserDto | null>(null);
	let isLoading = $state(true);
	let isEditing = $state(false);
	let isSaving = $state(false);
	let isSigningOut = $state(false);
	let errorMessage = $state('');
	let notice = $state('');
	let passwordSuccess = $state('');
	let email = $state('');
	let profileCodeSent = $state(false);
	let profileCode = $state('');
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmNewPassword = $state(false);
	let isSendingCode = $state(false);
	let isChangingPassword = $state(false);
	let passwordError = $state('');
	let resendSeconds = $state(0);
	let codeSeconds = $state(0);
	let countdownInterval: ReturnType<typeof setInterval> | null = null;
	let isUploadingAvatar = $state(false);
	let avatarPreviewUrl = $state('');

	function startCodeCountdowns() {
		if (countdownInterval) clearInterval(countdownInterval);
		resendSeconds = 60;
		codeSeconds = 180;
		countdownInterval = setInterval(() => {
			resendSeconds = Math.max(0, resendSeconds - 1);
			codeSeconds = Math.max(0, codeSeconds - 1);
			if (resendSeconds === 0 && codeSeconds === 0 && countdownInterval) {
				clearInterval(countdownInterval);
				countdownInterval = null;
			}
		}, 1000);
	}

	function formatCountdown(seconds: number) {
		return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
	}

	onMount(async () => {
		try { user = await getCurrentUser(); email = user.email; }
		catch { goto('/signin'); }
		finally { isLoading = false; }
	});

	function formatDate(value?: string) {
		return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) : '-';
	}

	async function saveProfile() {
		if (!user) return;
		isSaving = true; errorMessage = ''; notice = '';
		try {
			await updateCurrentUser({ email: email.trim() });
			user = await getCurrentUser();
			isEditing = false; notice = 'Profil berhasil diperbarui.';
		} catch (error: any) { errorMessage = error.message || 'Gagal memperbarui profil.'; }
		finally { isSaving = false; }
	}

	async function handleAvatarSelection(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			errorMessage = 'Foto profil harus berformat JPG, PNG, atau WebP.';
			input.value = '';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			errorMessage = 'Ukuran foto profil maksimal 5 MB.';
			input.value = '';
			return;
		}
		if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
		avatarPreviewUrl = URL.createObjectURL(file);
		errorMessage = '';
		isUploadingAvatar = true;
		try {
			const uploaded = await uploadImage(file, 'profile');
			await updateCurrentUser({ profile_image_url: uploaded.url });
			user = await getCurrentUser();
			notice = 'Foto profil berhasil diperbarui.';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui foto profil.';
		} finally {
			isUploadingAvatar = false;
			if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
			avatarPreviewUrl = '';
			input.value = '';
		}
	}

	async function sendProfileCode() {
		passwordError = '';
		passwordSuccess = '';
		if (!currentPassword) { passwordError = 'Masukkan password lama terlebih dahulu.'; return; }
		if (newPassword === currentPassword) { passwordError = 'Password baru harus berbeda dari password lama.'; return; }
		if (!isStrongPassword(newPassword)) { passwordError = PASSWORD_REQUIREMENTS; return; }
		if (newPassword !== confirmNewPassword) { passwordError = 'Konfirmasi password baru tidak cocok.'; return; }
		isSendingCode = true; errorMessage = ''; notice = '';
		try {
			const response = await requestProfilePasswordCode(currentPassword);
			profileCodeSent = true;
			startCodeCountdowns();
			notice = response.message;
		} catch (error: any) { passwordError = error.message || 'Gagal mengirim kode konfirmasi.'; }
		finally { isSendingCode = false; }
	}

	async function saveNewPassword() {
		passwordError = '';
		passwordSuccess = '';
		if (!profileCode.trim()) { passwordError = 'Masukkan kode verifikasi dari email.'; return; }
		if (newPassword === currentPassword) { passwordError = 'Password baru harus berbeda dari password lama.'; return; }
		if (!isStrongPassword(newPassword)) { passwordError = PASSWORD_REQUIREMENTS; return; }
		if (newPassword !== confirmNewPassword) { passwordError = 'Konfirmasi password baru tidak cocok.'; return; }
		isChangingPassword = true; errorMessage = ''; notice = '';
		try {
			const response = await changeProfilePassword({ currentPassword, code: profileCode, password: newPassword, confirmPassword: confirmNewPassword });
			passwordSuccess = response.message || 'Password berhasil diubah. Gunakan password baru saat login berikutnya.';
			profileCodeSent = false; profileCode = ''; currentPassword = ''; newPassword = ''; confirmNewPassword = '';
			if (countdownInterval) clearInterval(countdownInterval);
			countdownInterval = null; resendSeconds = 0; codeSeconds = 0;
		} catch (error: any) { passwordError = error.message || 'Gagal memperbarui password.'; }
		finally { isChangingPassword = false; }
	}

	onDestroy(() => {
		if (countdownInterval) clearInterval(countdownInterval);
		if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
	});

	async function signout() {
		isSigningOut = true; errorMessage = '';
		try { await signoutApi(); localStorage.removeItem('user'); goto('/dashboard'); }
		catch (error: any) { errorMessage = error.message || 'Gagal keluar dari akun.'; }
		finally { isSigningOut = false; }
	}

	let profileInitial = $derived(user?.email?.slice(0, 1).toUpperCase() || '?');
</script>

<svelte:head><title>Profil | Tani Siaga</title></svelte:head>

<div class="kerangka-halaman"><div class="wadah-halaman">
	<a class="tautan-kembali" href="/dashboard">← Kembali ke dashboard</a>
	{#if isLoading}<div class="keadaan">Memuat profil...</div>
	{:else if user}<div class="kepala-profil"><div><p class="label-kecil">AKUN TANI SIAGA</p><h1 class="judul">Profil kamu</h1><p class="subjudul">Kelola informasi akun dan lihat status keanggotaanmu.</p></div><div class="kontrol-foto"><div class="foto-profil">{#if avatarPreviewUrl || user.profile_image_url}<img src={avatarPreviewUrl || user.profile_image_url || ''} alt="Foto profil" />{:else}{profileInitial}{/if}</div><label class="unggah-foto">{isUploadingAvatar ? 'Mengunggah...' : 'Pilih foto'}<input type="file" accept="image/jpeg,image/png,image/webp" onchange={handleAvatarSelection} disabled={isUploadingAvatar} /></label></div></div>
		{#if notice}<div class="peringatan">{notice}</div>{/if}{#if errorMessage}<div class="peringatan galat">{errorMessage}</div>{/if}
		<section class="kartu-profil">
			<div class="judul-kartu"><div><p class="label-kecil">INFORMASI PROFIL</p><h2>Data akun</h2></div>{#if !isEditing}<button class="tombol-garis" type="button" onclick={() => (isEditing = true)}>Ubah data</button>{/if}</div>
			{#if isEditing}
				<form class="formulir-ubah" onsubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
					<label>Email aktif<input type="email" bind:value={email} required /></label>
					<div class="aksi-formulir">
						<button class="tombol-tenang" type="button" onclick={() => { isEditing = false; email = user?.email || ''; }}>Batal</button>
						<button class="tombol-utama" type="submit" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Terapkan perubahan'}</button>
					</div>
				</form>
			{:else}
				<div class="fakta"><div><span>Email</span><strong>{user.email}</strong></div><div><span>Peran</span><strong>{user.role || 'Pengguna'}</strong></div><div><span>Provider akun</span><strong>{user.provider || 'local'}</strong></div><div><span>ID pengguna</span><strong>#{user.id ?? user.userId ?? '-'}</strong></div></div>
			{/if}
		</section>
		<section class="kartu-profil kartu-sandi">
			<details class="menu-pilihan-sandi">
				<summary class="judul-kartu ringkasan-sandi"><div><p class="label-kecil">KEAMANAN AKUN</p><h2>Ubah password</h2></div><span class="panah-menu-pilihan" aria-hidden="true">⌄</span></summary>
				<div class="isi-sandi">
				{#if passwordSuccess}<div class="berhasil-sandi" role="status">{passwordSuccess}</div>{/if}
				<p class="bantuan-sandi">Masukkan password lama, tentukan password baru, lalu konfirmasi kode yang dikirim ke <strong>{user.email}</strong>.</p>
				{#if passwordError}<div class="peringatan galat galat-sandi" role="alert">{passwordError}</div>{/if}
				<form class="formulir-ubah" novalidate onsubmit={(event) => { event.preventDefault(); if (profileCodeSent) void saveNewPassword(); else void sendProfileCode(); }}>
				<label>Password lama<div class="masukan-sandi"><input type={showCurrentPassword ? 'text' : 'password'} bind:value={currentPassword} required autocomplete="current-password" placeholder="Masukkan password saat ini" disabled={profileCodeSent || isSendingCode || isChangingPassword} /><button class="alih-sandi" type="button" aria-label={showCurrentPassword ? 'Sembunyikan password lama' : 'Tampilkan password lama'} title={showCurrentPassword ? 'Sembunyikan password' : 'Tampilkan password'} onclick={() => (showCurrentPassword = !showCurrentPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{#if showCurrentPassword}<path d="m4 4 16 16" />{/if}</svg></button></div></label>
				<label>Password baru<div class="masukan-sandi"><input type={showNewPassword ? 'text' : 'password'} bind:value={newPassword} required minlength="8" autocomplete="new-password" placeholder="Password kuat" disabled={profileCodeSent || isSendingCode || isChangingPassword} /><button class="alih-sandi" type="button" aria-label={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'} title={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'} onclick={() => (showNewPassword = !showNewPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{#if showNewPassword}<path d="m4 4 16 16" />{/if}</svg></button></div><small class="petunjuk-sandi">{PASSWORD_REQUIREMENTS}</small></label>
				<label>Konfirmasi password baru<div class="masukan-sandi"><input type={showConfirmNewPassword ? 'text' : 'password'} bind:value={confirmNewPassword} required minlength="8" autocomplete="new-password" placeholder="Ulangi password baru" disabled={profileCodeSent || isSendingCode || isChangingPassword} /><button class="alih-sandi" type="button" aria-label={showConfirmNewPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'} title={showConfirmNewPassword ? 'Sembunyikan password' : 'Tampilkan password'} onclick={() => (showConfirmNewPassword = !showConfirmNewPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{#if showConfirmNewPassword}<path d="m4 4 16 16" />{/if}</svg></button></div></label>
				{#if profileCodeSent}
					<p class="hitung-mundur-otp">Kode berlaku {formatCountdown(codeSeconds)} lagi.</p>
					<label>Kode verifikasi email<input bind:value={profileCode} required minlength="6" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="Kode 6 digit" disabled={isChangingPassword} /></label>
				{/if}
				<div class="aksi-formulir">
					{#if profileCodeSent}<button class="tombol-tenang" type="button" onclick={() => { profileCodeSent = false; profileCode = ''; currentPassword = ''; newPassword = ''; confirmNewPassword = ''; }}>Batal</button>{/if}
					<button class="tombol-utama" type="submit" disabled={isSendingCode || isChangingPassword}>{isSendingCode ? 'Mengirim kode...' : isChangingPassword ? 'Menyimpan...' : profileCodeSent ? 'Verifikasi & ubah password' : 'Verifikasi password lama & kirim kode'}</button>
				</div>
				{#if profileCodeSent}<button class="kode-kirim" type="button" onclick={sendProfileCode} disabled={isSendingCode || resendSeconds > 0}>{isSendingCode ? 'Mengirim...' : resendSeconds > 0 ? `Kirim ulang kode (${formatCountdown(resendSeconds)})` : 'Kirim ulang kode'}</button>{/if}
				</form>
				</div>
			</details>
		</section>
		<section class="kartu-profil kartu-status"><div class="judul-kartu"><div><p class="label-kecil">KEANGGOTAAN</p><h2>Status pertanian</h2></div><span class="lencana-status">{user.group_status || 'none'}</span></div><div class="fakta"><div><span>ID kelompok tani</span><strong>{user.farmer_group_id ?? 'Belum bergabung'}</strong></div><div><span>Permintaan kelompok</span><strong>{user.pending_farmer_group_id ?? 'Tidak ada'}</strong></div><div><span>Akun dibuat</span><strong>{formatDate(user.created_at)}</strong></div><div><span>Terakhir diperbarui</span><strong>{formatDate(user.updated_at)}</strong></div></div></section>
		<div class="baris-keluar"><p>Sudah selesai menggunakan Tani Siaga?</p><button class="tombol-keluar" type="button" onclick={signout} disabled={isSigningOut}>{isSigningOut ? 'Keluar...' : 'Sign out'}</button></div>
	{:else}<div class="keadaan galat">Profil tidak dapat dimuat.</div>{/if}
</div></div>

<style>
	.kerangka-halaman {
		min-height: 100vh;
		background: #f4f7f1;
		color: #183126;
		padding: 36px 20px 70px;
	}
	.wadah-halaman {
		max-width: 880px;
		margin: auto;
	}
	.tautan-kembali {
		display: inline-block;
		margin-bottom: 30px;
		color: #39754b;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.kepala-profil {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 20px;
		margin-bottom: 28px;
	}
	.label-kecil {
		margin: 0 0 9px;
		color: #4e805a;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	.kepala-profil h1 {
		margin: 0;
		font: 600 clamp(38px,6vw,58px)/1 'Fraunces',Georgia,serif;
	}
	.subjudul {
		margin: 14px 0 0;
		color: #718077;
		line-height: 1.55;
	}
	.foto-profil {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: #dcebd8;
		color: #39754b;
		font: 700 29px 'Fraunces',Georgia,serif;
	}
	.kartu-profil {
		margin-top: 16px;
		padding: 26px;
		border: 1px solid #d6e1d5;
		border-radius: 10px;
		background: #fff;
		box-shadow: 0 8px 22px #23472e0a;
	}
	.judul-kartu {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 16px;
		border-bottom: 1px solid #e8eee6;
		padding-bottom: 17px;
	}
	.judul-kartu .label-kecil {
		margin-bottom: 5px;
	}
	.judul-kartu h2 {
		margin: 0;
		color: #274a32;
		font-size: 20px;
	}
	.tombol-garis,.tombol-tenang,.tombol-utama,.tombol-keluar {
		border-radius: 7px;
		padding: 10px 13px;
		font: 700 12px 'DM Sans',sans-serif;
		cursor: pointer;
	}
	.tombol-garis,.tombol-tenang {
		border: 1px solid #d6e1d5;
		background: #fff;
		color: #39754b;
	}
	.tombol-utama {
		border: 1px solid #39754b;
		background: #39754b;
		color: #fff;
	}
	.tombol-utama:disabled,.tombol-keluar:disabled {
		opacity: .6;
		cursor: wait;
	}
	.fakta {
		display: grid;
		grid-template-columns: repeat(2,1fr);
		gap: 12px;
		padding-top: 20px;
	}
	.fakta div {
		min-width: 0;
		padding: 14px;
		border-radius: 8px;
		background: #f7faf6;
	}
	.fakta span {
		display: block;
		margin-bottom: 7px;
		color: #718077;
		font-size: 11px;
	}
	.fakta strong {
		display: block;
		color: #274a32;
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.formulir-ubah {
		display: grid;
		gap: 16px;
		padding-top: 20px;
	}
	.formulir-ubah label {
		display: grid;
		gap: 7px;
		color: #385540;
		font-size: 12px;
		font-weight: 700;
	}
	.formulir-ubah input {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		background: #fbfdfb;
		color: #183126;
		padding: 12px;
		font: inherit;
		outline: 0;
	}
	.formulir-ubah input:focus {
		border-color: #5c9568;
		box-shadow: 0 0 0 3px #5c95681c;
	}
	.aksi-formulir {
		display: flex;
		justify-content: flex-end;
		gap: 9px;
		border-top: 1px solid #e8eee6;
		padding-top: 18px;
	}
	.kartu-status {
		margin-top: 16px;
	}
	.lencana-status {
		border-radius: 999px;
		background: #edf8ed;
		color: #39754b;
		padding: 7px 10px;
		font-size: 11px;
		font-weight: 800;
		text-transform: capitalize;
	}
	.baris-keluar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 18px;
		margin-top: 20px;
		padding: 18px 2px;
		border-top: 1px solid #d6e1d5;
	}
	.baris-keluar p {
		margin: 0;
		color: #718077;
		font-size: 13px;
	}
	.tombol-keluar {
		border: 1px solid #e6b8b3;
		background: #fff0ef;
		color: #a44242;
	}
	.peringatan,.keadaan {
		padding: 14px;
		border-radius: 8px;
		background: #fff;
		border: 1px solid #d6e1d5;
	}
	.peringatan {
		margin-bottom: 16px;
		background: #edf8ed;
		color: #39754b;
		font-size: 13px;
	}
	.peringatan.galat,.keadaan.galat {
		background: #fff0ef;
		color: #a44242;
	}
	.keadaan {
		text-align: center;
		color: #718077;
	}
	@media (max-width:600px) {
		.kerangka-halaman {
			padding: 26px 14px 50px;
		}
		.kepala-profil {
			align-items: start;
		}
		.foto-profil {
			width: 56px;
			height: 56px;
			font-size: 23px;
		}
		.kartu-profil {
			padding: 20px;
		}
		.fakta {
			grid-template-columns: 1fr;
		}
		.baris-keluar {
			align-items: flex-start;
			flex-direction: column;
		}
	}
	.masukan-sandi {
		position: relative;
	}
	.masukan-sandi input {
		padding-right: 48px;
	}
	.alih-sandi {
		position: absolute;
		top: 50%;
		right: 7px;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		transform: translateY(-50%);
		padding: 6px;
		border: 0;
		background: transparent;
		color: #52705a;
		cursor: pointer;
	}
	.alih-sandi svg {
		width: 19px;
		height: 19px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.kode-kirim {
		border: 0;
		padding: 0;
		background: transparent;
		color: #39754b;
		font-size: 12px;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}
	.kode-kirim:disabled {
		opacity: .55;
		cursor: wait;
	}
	.hitung-mundur-otp {
		margin: 0;
		color: #718077;
		font-size: 11px;
	}
	.petunjuk-sandi {
		color: #718077;
		font-size: 11px;
		font-weight: 400;
	}
	.menu-pilihan-sandi>summary {
		cursor: pointer;
		list-style: none;
	}
	.menu-pilihan-sandi>summary::-webkit-details-marker {
		display: none;
	}
	.ringkasan-sandi {
		align-items: center;
	}
	.panah-menu-pilihan {
		color: #52705a;
		font-size: 23px;
		line-height: 1;
		transition: transform .18s ease;
	}
	.menu-pilihan-sandi[open] .panah-menu-pilihan {
		transform: rotate(180deg);
	}
	.menu-pilihan-sandi:not([open])>summary {
		border-bottom: 0;
		padding-bottom: 0;
	}
	.isi-sandi {
		padding-top: 2px;
	}
	.berhasil-sandi {
		margin: 16px 0 0;
		border: 1px solid #b8d8b7;
		border-radius: 7px;
		padding: 12px;
		background: #edf8ed;
		color: #2f6a41;
		font-size: 13px;
		line-height: 1.5;
	}
	.galat-sandi {
		margin: 0 0 4px;
	}
	.kontrol-foto {
		display: grid;
		justify-items: center;
		gap: 8px;
	}
	.foto-profil {
		overflow: hidden;
	}
	.foto-profil img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.unggah-foto {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 32px;
		border: 1px solid #39754b;
		border-radius: 7px;
		background: #edf8ed;
		color: #39754b;
		padding: 0 12px;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		transition: background .15s, color .15s;
	}
	.unggah-foto:hover {
		background: #39754b;
		color: #fff;
	}
	.unggah-foto input {
		position: absolute;
		inset: 0;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
</style>
