<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(async () => {
		await goto('/dashboard', { replaceState: true });
	});
</script>

<div class="keadaan-alihkan">Mengalihkan ke Dashboard...</div>

<style>
	.keadaan-alihkan {
		padding: 80px 40px;
		text-align: center;
		color: #718077;
		font-weight: 600;
	}
</style>
