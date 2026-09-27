<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => { void goto('/ai-recommendations', { replaceState: true }); });
</script>

<svelte:head>
	<title>Rekomendasi AI | Tani Siaga</title>
</svelte:head>

<main class="redirect-page">
	<p>Membuka rekomendasi AI...</p>
	<a href="/ai-recommendations">Buka halaman rekomendasi AI</a>
</main>

<style>
	.redirect-page { display: grid; place-content: center; min-height: 50vh; gap: 8px; color: #718077; text-align: center; }
	.redirect-page p { margin: 0; }
	.redirect-page a { color: #39754b; font-size: 13px; font-weight: 700; }
</style>
