<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { requestPasswordResetCode, resetPasswordApi, verifyPasswordResetCode } from '$lib/api/auth-api';
	import { isStrongPassword, PASSWORD_REQUIREMENTS } from '$lib/services/password-validation';

	let email = $state('');
	let code = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let codeSent = $state(false);
	let codeVerified = $state(false);
	let isDone = $state(false);
	let isLoading = $state(false);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let resendSeconds = $state(0);
	let codeSeconds = $state(0);
	let countdownInterval: ReturnType<typeof setInterval> | null = null;

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

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		successMessage = '';
		isLoading = true;
		try {
			if (!codeSent) {
				const response = await requestPasswordResetCode(email.trim());
				codeSent = true;
				startCodeCountdowns();
				successMessage = response.message;
				return;
			}
			if (!codeVerified) {
				const response = await verifyPasswordResetCode(email.trim(), code);
				codeVerified = true;
				successMessage = response.message;
				return;
			}
			if (!isStrongPassword(password)) throw new Error(PASSWORD_REQUIREMENTS);
			if (password !== confirmPassword) throw new Error('Konfirmasi password tidak cocok.');
			const response = await resetPasswordApi({ email: email.trim(), code, password, confirmPassword });
			isDone = true;
			successMessage = response.message;
			setTimeout(() => { void goto('/signin'); }, 1300);
		} catch (error: any) {
			errorMessage = error.message || 'Proses reset password gagal.';
		} finally {
			isLoading = false;
		}
	}

	async function resendCode() {
		isLoading = true;
		errorMessage = '';
		try {
			const response = await requestPasswordResetCode(email.trim());
			startCodeCountdowns();
			successMessage = response.message;
		} catch (error: any) {
			errorMessage = error.message || 'Gagal mengirim ulang kode.';
		} finally {
			isLoading = false;
		}
	}

	onDestroy(() => { if (countdownInterval) clearInterval(countdownInterval); });
</script>

<svelte:head><title>Lupa Password | Tani Siaga</title></svelte:head>

<main class="auth-shell">
	<section class="auth-panel">
		<a class="brand" href="/">🌱 <span>Tani Siaga</span></a>
		<p class="kicker">PEMULIHAN AKUN</p>
		<h1>{isDone ? 'Password diperbarui.' : 'Atur ulang password.'}</h1>
		<p class="intro">{isDone ? 'Silakan masuk kembali menggunakan password baru.' : 'Kami akan mengirim kode verifikasi ke email akunmu.'}</p>
		{#if errorMessage}<div class="alert error">{errorMessage}</div>{/if}
		{#if successMessage}<div class="alert success">{successMessage}</div>{/if}
		{#if isDone}
			<button class="submit" type="button" onclick={() => goto('/signin')}>Ke halaman signin</button>
		{:else}
			<form onsubmit={submit}>
				<label>Email akun<input type="email" bind:value={email} required disabled={isLoading || codeSent} autocomplete="email" placeholder="kamu@email.com" /></label>
				{#if codeSent}
					<p class="code-countdown">Kode berlaku {formatCountdown(codeSeconds)} lagi.</p>
					<label>Kode verifikasi<input bind:value={code} required minlength="6" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="Kode 6 digit" disabled={isLoading} /></label>
				{/if}
				{#if codeVerified}
					<label>Password baru<div class="password-entry"><input type={showPassword ? 'text' : 'password'} bind:value={password} required minlength="8" autocomplete="new-password" placeholder="Password kuat" disabled={isLoading} /><button class="password-toggle" type="button" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} onclick={() => (showPassword = !showPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{#if showPassword}<path d="m4 4 16 16" />{/if}</svg></button></div><small class="password-hint">{PASSWORD_REQUIREMENTS}</small></label>
					<label>Konfirmasi password baru<div class="password-entry"><input type={showConfirmPassword ? 'text' : 'password'} bind:value={confirmPassword} required minlength="8" autocomplete="new-password" placeholder="Ulangi password baru" disabled={isLoading} /><button class="password-toggle" type="button" aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'} title={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'} onclick={() => (showConfirmPassword = !showConfirmPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{#if showConfirmPassword}<path d="m4 4 16 16" />{/if}</svg></button></div></label>
				{/if}
				<button class="submit" type="submit" disabled={isLoading}>{isLoading ? 'Memproses...' : codeVerified ? 'Simpan password baru' : codeSent ? 'Verifikasi kode' : 'Kirim kode verifikasi'}</button>
				{#if codeSent && !codeVerified}<button class="resend-button" type="button" onclick={resendCode} disabled={isLoading || resendSeconds > 0}>{resendSeconds > 0 ? `Kirim ulang kode (${formatCountdown(resendSeconds)})` : 'Kirim ulang kode'}</button>{/if}
			</form>
		{/if}
		<p class="switch"><a href="/signin">Kembali ke signin</a></p>
	</section>
	<aside class="auth-aside"><span class="leaf">🌾</span><p>Kembalikan akses akunmu dengan aman.</p></aside>
</main>

<style>
	:global(body) { margin: 0; font-family: Georgia, 'Times New Roman', serif; }
	.auth-shell { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 38%); background: #f4f7f1; color: #183126; }
	.auth-panel { width: min(430px, calc(100% - 48px)); margin: auto; }
	.brand { display: inline-flex; gap: 8px; align-items: center; color: #183126; font-size: 22px; font-weight: 700; text-decoration: none; }
	.kicker { margin: 52px 0 12px; color: #4e805a; font: 800 11px Arial, sans-serif; letter-spacing: .14em; }
	h1 { margin: 0; font-size: clamp(34px, 5vw, 52px); line-height: 1.04; font-weight: 600; }
	.intro { max-width: 380px; margin: 16px 0 25px; color: #718077; font: 15px/1.6 Arial, sans-serif; }
	form { display: grid; gap: 15px; }
	label { display: grid; gap: 7px; color: #385540; font: 700 12px Arial, sans-serif; }
	.password-hint { color: #718077; font: 11px/1.4 Arial, sans-serif; font-weight: 400; }
	input { box-sizing: border-box; width: 100%; border: 1px solid #d6e1d5; border-radius: 7px; padding: 12px; background: #fff; color: #183126; font: 14px Arial, sans-serif; outline: 0; }
	input:focus { border-color: #39754b; box-shadow: 0 0 0 3px #39754b1c; }
	.password-entry { position: relative; }
	.password-entry input { padding-right: 48px; }
	.password-toggle { position: absolute; top: 50%; right: 7px; display: grid; place-items: center; width: 34px; height: 34px; transform: translateY(-50%); padding: 6px; border: 0; background: transparent; color: #52705a; cursor: pointer; }
	.password-toggle svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
	.submit { width: 100%; margin-top: 3px; border: 0; border-radius: 7px; padding: 12px; background: #39754b; color: #fff; font: 700 13px Arial, sans-serif; cursor: pointer; }
	.submit:disabled { opacity: .6; cursor: wait; }
	.resend-button { border: 0; padding: 0; background: transparent; color: #39754b; font: 700 12px Arial, sans-serif; text-decoration: underline; cursor: pointer; }
	.code-countdown { margin: 0; color: #718077; font: 11px Arial, sans-serif; }
	.alert { margin: 0 0 12px; border-radius: 7px; padding: 11px; font: 12px Arial, sans-serif; }
	.alert.error { background: #fff0ef; color: #a44242; }
	.alert.success { background: #edf8ed; color: #39754b; }
	.switch { margin-top: 18px; color: #718077; font: 13px Arial, sans-serif; }
	.switch a { color: #39754b; font-weight: 700; }
	.auth-aside { display: flex; flex-direction: column; justify-content: center; padding: 48px; background: #dcebd8; }
	.auth-aside p { max-width: 250px; margin: 0; color: #274a32; font-size: 26px; line-height: 1.2; }
	.leaf { margin-bottom: 18px; font-size: 44px; }
	@media (max-width: 700px) { .auth-shell { display: block; }.auth-panel { padding: 40px 0 48px; }.auth-aside { display: none; } }
	@media (max-height: 760px) { .kicker { margin-top: 24px; }.intro { margin: 10px 0 16px; }form { gap: 11px; }.auth-aside { padding: 32px; } }
</style>