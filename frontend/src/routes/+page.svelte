<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(async () => {
		await goto('/dashboard', { replaceState: true });
	});
</script>

<div class="redirect-state">Mengalihkan ke Dashboard...</div>

<style>
	.redirect-state {
		padding: 80px 40px;
		text-align: center;
		color: #718077;
		font-weight: 600;
	}
</style>
