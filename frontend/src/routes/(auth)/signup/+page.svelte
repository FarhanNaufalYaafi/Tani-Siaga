<script lang="ts">
  import { onDestroy } from 'svelte';
  import { signupApi, verifySignupEmailApi } from '$lib/api/auth-api';
  import { API_BASE_URL } from '$lib/api/api-url';
  import { isStrongPassword, PASSWORD_REQUIREMENTS } from '$lib/services/password-validation';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let verificationCode = $state('');
  let codeSent = $state(false);
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let resendSeconds = $state(0);
  let codeSeconds = $state(0);
  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  let isLoading = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    isLoading = true;
    try {
      if (codeSent) {
        const response = await verifySignupEmailApi({ email, code: verificationCode });
        localStorage.setItem('user', JSON.stringify(response));
        await goto('/dashboard');
        return;
      }
      if (password !== confirmPassword) throw new Error('Konfirmasi password tidak cocok.');
      if (!isStrongPassword(password)) throw new Error(PASSWORD_REQUIREMENTS);
      const response = await signupApi({ email, password });
      codeSent = true;
      startCodeCountdowns();
      successMessage = response.message || `Kode verifikasi dikirim ke ${email}. Periksa inbox atau folder spam.`;
    } catch (error: any) { errorMessage = error.message || 'Gagal membuat akun.'; }
    finally { isLoading = false; }
  }
  
  async function resendCode() {
    isLoading = true;
    errorMessage = '';
    try {
      const response = await signupApi({ email, password });
      startCodeCountdowns();
      successMessage = response.message || 'Kode verifikasi baru sudah dikirim.';
    } catch (error: any) { errorMessage = error.message || 'Gagal mengirim ulang kode.'; }
    finally { isLoading = false; }
  }

  onDestroy(() => { if (countdownInterval) clearInterval(countdownInterval); });
</script>

<svelte:head><title>Daftar Akun | Tani Siaga</title></svelte:head>

<main class="auth-shell">
  <section class="auth-panel">
    <a class="brand" href="/"><img src="/tani-siaga-logo.svg" alt="" /><span>Tani Siaga</span></a>
    <p class="kicker">MULAI BERTUMBUH</p>
    <h1>Buat akun pertanianmu.</h1>
    <p class="intro">Simpan lahan, temukan kelompok, dan bangun rutinitas bertani yang lebih terukur.</p>
    {#if errorMessage}<div class="alert error">{errorMessage}</div>{/if}
    {#if successMessage}<div class="alert success">{successMessage}</div>{/if}
    <form onsubmit={handleSubmit}>
      <label>Email<input type="email" bind:value={email} required placeholder="kamu@email.com" disabled={isLoading || codeSent} /></label>
      {#if codeSent}
        <p class="verification-hint">Masukkan kode 6 digit yang dikirim ke email kamu.</p>
        <p class="code-countdown">Kode berlaku {formatCountdown(codeSeconds)} lagi.</p>
        <label>Kode verifikasi<input inputmode="numeric" autocomplete="one-time-code" bind:value={verificationCode} required minlength="6" maxlength="6" placeholder="000000" disabled={isLoading} /></label>
      {:else}
        <label>Password<div class="password-entry"><input type={showPassword ? 'text' : 'password'} bind:value={password} required placeholder="Password kuat" disabled={isLoading} /><button class="password-toggle" type="button" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} onclick={() => (showPassword = !showPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{#if showPassword}<path d="m4 4 16 16" />{/if}</svg></button></div><small class="password-hint">{PASSWORD_REQUIREMENTS}</small></label>
        <label>Konfirmasi password<div class="password-entry"><input type={showConfirmPassword ? 'text' : 'password'} bind:value={confirmPassword} required placeholder="Ulangi password" disabled={isLoading} /><button class="password-toggle" type="button" aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'} title={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'} onclick={() => (showConfirmPassword = !showConfirmPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{#if showConfirmPassword}<path d="m4 4 16 16" />{/if}</svg></button></div></label>
      {/if}
      <button type="submit" disabled={isLoading}>{isLoading ? (codeSent ? 'Memverifikasi...' : 'Mengirim kode...') : (codeSent ? 'Verifikasi & masuk' : 'Kirim kode verifikasi')}</button>
      {#if codeSent}<button class="resend-button" type="button" onclick={resendCode} disabled={isLoading || resendSeconds > 0}>{resendSeconds > 0 ? `Kirim ulang kode (${formatCountdown(resendSeconds)})` : 'Kirim ulang kode'}</button>{/if}
    </form>
    <div class="separator"><span>atau</span></div>
    <a class="google-button" href="{API_BASE_URL}/auth/google"><span class="google-mark">G</span>Daftar dengan Google</a>
    <p class="provider-note">{codeSent ? 'Kode ini hanya berlaku untuk email dan verifikasi signup ini.' : 'Password minimal 8 karakter dengan kombinasi kuat.'}</p>
    <p class="switch">Sudah punya akun? <a href="/signin">Masuk di sini</a></p>
  </section>
  <aside class="auth-aside"><span class="leaf">🌱</span><p>Mulai dari satu lahan, lalu tumbuhkan ekosistemmu.</p></aside>
</main>

<style>
  :global(body){margin:0;font-family:Georgia,'Times New Roman',serif}.auth-shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,38%);background:#f4f7f1;color:#183126}.auth-panel{width:min(430px,calc(100% - 48px));margin:auto}.brand{display:inline-flex;gap:8px;align-items:center;color:#183126;font-size:22px;font-weight:700;text-decoration:none}.kicker{margin:52px 0 12px;color:#4e805a;font:800 11px Arial,sans-serif;letter-spacing:.14em}.auth-panel h1{margin:0;font-size:clamp(34px,5vw,52px);line-height:1.04;font-weight:600}.intro{max-width:380px;color:#718077;font:15px/1.6 Arial,sans-serif;margin:16px 0 30px}form{display:grid;gap:18px}label{display:grid;gap:7px;color:#385540;font:700 12px Arial,sans-serif}.password-entry{position:relative}.password-entry input{padding-right:48px}input{box-sizing:border-box;width:100%;border:1px solid #d6e1d5;border-radius:7px;background:#fff;color:#183126;padding:13px;font:14px Arial,sans-serif;outline:0}input:focus{border-color:#39754b;box-shadow:0 0 0 3px #39754b1c}button{border:0;border-radius:7px;background:#39754b;color:#fff;padding:13px;font:700 13px Arial,sans-serif;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.password-toggle{position:absolute;top:50%;right:7px;display:grid;place-items:center;width:34px;height:34px;transform:translateY(-50%);padding:6px;background:transparent;color:#52705a}.password-toggle svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.verification-hint{margin:0;color:#52705a;font:13px/1.5 Arial,sans-serif}.password-hint{color:#718077;font:11px/1.4 Arial,sans-serif;font-weight:400}.switch{margin-top:24px;color:#718077;font:13px Arial,sans-serif}.switch a{color:#39754b;font-weight:700}.alert{margin-bottom:16px;border-radius:7px;padding:12px;font:13px Arial,sans-serif}.alert.error{background:#fff0ef;color:#a44242}.alert.success{background:#edf8ed;color:#39754b}.auth-aside{display:flex;flex-direction:column;justify-content:end;padding:48px;background:#dcebd8}.auth-aside p{max-width:250px;margin:0;color:#274a32;font-size:26px;line-height:1.2}.leaf{font-size:44px;margin-bottom:18px}@media(max-width:700px){.auth-shell{display:block}.auth-panel{padding:44px 0 52px}.auth-aside{display:none}}
  .separator{display:flex;align-items:center;gap:10px;margin:20px 0;color:#829087;font:11px Arial,sans-serif}.separator::before,.separator::after{content:'';height:1px;flex:1;background:#d6e1d5}.google-button{display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #c5d7c5;border-radius:7px;background:#fff;color:#183126;padding:12px;font:700 13px Arial,sans-serif;text-decoration:none}.google-button:hover{background:#f7fbf5}.google-mark{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;color:#4285f4;font:700 17px Arial,sans-serif}.provider-note{margin:10px 0 0;color:#829087;font:11px/1.45 Arial,sans-serif;text-align:center}
  .code-countdown{margin:0;color:#718077;font:11px Arial,sans-serif}
  .resend-button{padding:0;background:transparent;color:#39754b;text-decoration:underline}.resend-button:disabled{opacity:.55;cursor:wait}
  @media (max-height: 760px) {
    .kicker { margin-top: 26px; }
    .intro { margin: 10px 0 18px; }
    form { gap: 12px; }
    input { padding: 10px; }
    .separator { margin: 12px 0; }
    .google-button { padding: 10px; }
    .provider-note { margin-top: 6px; }
    .switch { margin-top: 14px; }
    .auth-aside { justify-content: center; padding: 32px; }
    .auth-aside p { font-size: 22px; }
  }
  @media (max-height: 650px) {
    .kicker { margin-top: 14px; }
    .auth-panel h1 { font-size: 38px; }
    .intro { margin: 8px 0 12px; font-size: 13px; }
    form { gap: 9px; }
    label { gap: 5px; }
    input { padding: 9px; }
    button { padding: 10px; }
    .separator { margin: 8px 0; }
    .google-button { padding: 9px; }
    .provider-note { margin-top: 4px; font-size: 10px; }
    .switch { margin-top: 9px; }
  }
  .brand { flex-direction: column; gap: 3px; font-size: 11px; line-height: 1.1; }
  .brand img { width: 42px; height: 42px; object-fit: contain; }
</style>
