<script lang="ts">
  import { signinApi } from '$lib/api/auth-api';
  import { API_BASE_URL } from '$lib/api/api-url';
  import { goto } from '$app/navigation';
  import signinAsideImage from '$lib/assets/signin-aside.jpg';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let isLoading = $state(false);
  let errorMessage = $state('');

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    isLoading = true;
    errorMessage = '';
    try {
      const response = await signinApi({ email, password });
      if (response.id && response.email) localStorage.setItem('user', JSON.stringify(response));
      goto('/dashboard');
    } catch (error: any) {
      errorMessage = error.message || 'Email atau password salah.';
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head><title>Masuk | Tani Siaga</title></svelte:head>

<main class="auth-shell">
  <a class="back-home" href="/dashboard" aria-label="Kembali ke menu awal" title="Kembali ke menu awal"><span aria-hidden="true">←</span></a>
  <section class="auth-panel">
    <a class="brand" href="/"><img src="/tani-siaga-logo.svg" alt="" /><span>Tani Siaga</span></a>
    <p class="kicker">EKOSISTEM PERTANIAN</p>
    <h1>Selamat datang kembali.</h1>
    <p class="intro">Masuk untuk melihat lahan, kelompok tani, dan informasi pertanianmu.</p>
    {#if errorMessage}<div class="alert">{errorMessage}</div>{/if}
    <form onsubmit={handleSubmit}>
      <label>Email<input type="email" bind:value={email} required placeholder="kamu@email.com" disabled={isLoading} /></label>
      <label>Password<div class="password-entry"><input type={showPassword ? 'text' : 'password'} bind:value={password} required placeholder="Masukkan password" disabled={isLoading} /><button class="password-toggle" type="button" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} onclick={() => (showPassword = !showPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{#if showPassword}<path d="m4 4 16 16" />{/if}</svg></button></div></label>
      <button type="submit" disabled={isLoading}>{isLoading ? 'Memeriksa...' : 'Masuk ke akun'}</button>
    </form>
    <a class="forgot-link" href="/forgot-password">Lupa password?</a>
    <div class="separator"><span>atau</span></div>
    <a class="google-button" href="{API_BASE_URL}/auth/google"><span class="google-mark">G</span>Masuk dengan Google</a>
    <p class="provider-note">Akun Google masuk tanpa password lokal.</p>
    <p class="switch">Belum punya akun? <a href="/signup">Daftar sekarang</a></p>
  </section>
  <aside class="auth-aside">
    <img class="auth-aside-image" src={signinAsideImage} alt="" />
    <p>Ruang kerja yang lebih rapi untuk lahan dan kelompok tani.</p>
  </aside>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .auth-shell {
    position: relative;
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 38%);
    background: #f4f7f1;
    color: #183126;
  }
  .auth-panel {
    width: min(430px, calc(100% - 48px));
    margin: auto;
  }
  .back-home {
    position: absolute;
    z-index: 5;
    top: 24px;
    left: 24px;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 6px;
    background: #183126;
    color: #fff;
    font: 700 22px/1 Arial, sans-serif;
    text-decoration: none;
    transition: background-color .2s ease, transform .2s ease;
  }
  .back-home:hover { background: #285f3d; transform: translateX(-2px); }
  .back-home:focus-visible { outline: 2px solid #39754b; outline-offset: 4px; }
  .brand {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    color: #183126;
    font-size: 22px;
    font-weight: 700;
    text-decoration: none;
  }
  .kicker {
    margin: 52px 0 12px;
    color: #4e805a;
    font: 800 11px Arial, sans-serif;
    letter-spacing: .14em;
  }
  .auth-panel h1 {
    margin: 0;
    font-size: clamp(34px, 5vw, 52px);
    line-height: 1.04;
    font-weight: 600;
  }
  .intro {
    max-width: 380px;
    color: #718077;
    font: 15px/1.6 Arial, sans-serif;
    margin: 16px 0 30px;
  }
  form {
    display: grid;
    gap: 18px;
  }
  label {
    display: grid;
    gap: 7px;
    color: #385540;
    font: 700 12px Arial, sans-serif;
  }
  .password-entry {
    position: relative;
  }
  .password-entry input {
    padding-right: 48px;
  }
  input {
    box-sizing: border-box;
    width: 100%;
    border: 1px solid #d6e1d5;
    border-radius: 7px;
    background: #fff;
    color: #183126;
    padding: 13px;
    font: 14px Arial, sans-serif;
    outline: 0;
  }
  input:focus {
    border-color: #39754b;
    box-shadow: 0 0 0 3px #39754b1c;
  }
  button {
    border: 0;
    border-radius: 7px;
    background: #39754b;
    color: #fff;
    padding: 13px;
    font: 700 13px Arial, sans-serif;
    cursor: pointer;
  }
  button:disabled {
    opacity: .6;
    cursor: wait;
  }
  .password-toggle {
    position: absolute;
    top: 50%;
    right: 7px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    transform: translateY(-50%);
    padding: 6px;
    background: transparent;
    color: #52705a;
  }
  .password-toggle svg {
    width: 19px;
    height: 19px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .forgot-link {
    display: block;
    margin-top: 10px;
    color: #39754b;
    font: 700 12px Arial, sans-serif;
    text-align: right;
  }
  .switch {
    margin-top: 24px;
    color: #718077;
    font: 13px Arial, sans-serif;
  }
  .switch a {
    color: #39754b;
    font-weight: 700;
  }
  .alert {
    margin-bottom: 16px;
    border-radius: 7px;
    background: #fff0ef;
    color: #a44242;
    padding: 12px;
    font: 13px Arial, sans-serif;
  }
  .auth-aside {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    background: #dcebd8;
    overflow: hidden;
  }
  .auth-aside-image {
    position: absolute;
    z-index: 0;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  .auth-aside::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    background: linear-gradient(180deg, #10251b20 0%, #10251b05 38%, #10251b99 100%);
    content: '';
    pointer-events: none;
  }
  .auth-aside p {
    position: relative;
    z-index: 2;
    max-width: 250px;
    margin: 0;
    padding: 0;
    background: transparent;
    color: #fff;
    font-size: 26px;
    line-height: 1.2;
    text-align: center;
    text-shadow: 0 2px 12px #10251b;
  }
  @media(max-width:700px) {
    .auth-shell {
      position: relative;
      display: block;
      padding: 24px 0;
    }
    .auth-panel {
      position: relative;
      z-index: 1;
      width: min(430px, calc(100% - 32px));
      padding: 30px 22px;
      border-radius: 8px;
      background: #f4f7f1ed;
      backdrop-filter: blur(8px);
    }
    .auth-aside {
      position: absolute;
      z-index: 0;
      inset: 0;
      display: block;
      padding: 0;
    }
    .auth-aside p { display: none; }
  }
  .separator {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 20px 0;
    color: #829087;
    font: 11px Arial, sans-serif;
  }
  .separator::before,
  .separator::after {
    content: '';
    height: 1px;
    flex: 1;
    background: #d6e1d5;
  }
  .google-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 1px solid #c5d7c5;
    border-radius: 7px;
    background: #fff;
    color: #183126;
    padding: 12px;
    font: 700 13px Arial, sans-serif;
    text-decoration: none;
  }
  .google-button:hover {
    background: #f7fbf5;
  }
  .google-mark {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: #4285f4;
    font: 700 17px Arial, sans-serif;
  }
  .provider-note {
    margin: 10px 0 0;
    color: #829087;
    font: 11px/1.45 Arial, sans-serif;
    text-align: center;
  }
  @media (max-height: 760px) {
    .kicker { 
      margin-top: 26px; 
    }
    .intro {
      margin: 10px 0 18px;
    }
    form {
      gap: 12px;
    }
    input {
      padding: 10px;
    }
    .separator {
      margin: 12px 0;
    }
    .google-button {
      padding: 10px;
    }
    .provider-note {
      margin-top: 6px;
    }
    .switch {
      margin-top: 14px;
    }
    .auth-aside {
      justify-content: center;
      padding: 32px;
    }
    .auth-aside p {
      font-size: 22px;
    }
  }
  @media (max-height: 650px) {
    .kicker {
      margin-top: 14px;
    }
    .auth-panel h1 {
      font-size: 38px;
    }
    .intro {
      margin: 8px 0 12px;
      font-size: 13px;
    }
    form {
      gap: 9px;
    }
    label {
      gap: 5px;
    }
    input {
      padding: 9px;
    }
    button {
      padding: 10px;
    }
    .separator {
      margin: 8px 0;
    }
    .google-button {
      padding: 9px;
    }
    .provider-note {
      margin-top: 4px;
      font-size: 10px;
    }
    .switch {
      margin-top: 9px;
    }
  }
  .brand {
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
    line-height: 1.1;
  }
  .brand img {
    width: 42px;
    height: 42px;
    object-fit: contain;
  }
</style>