<script lang="ts">
  let { page, totalPages, disabled = false, onPageChange } = $props<{
    page: number;
    totalPages: number;
    disabled?: boolean;
    onPageChange: (page: number) => void;
  }>();

  let visiblePages = $derived.by(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const count = Math.min(5, totalPages);
    return Array.from({ length: count }, (_, index) => start + index);
  });
</script>

{#if totalPages > 1}
  <nav class="pagination" aria-label="Navigasi halaman">
    <button class="page-button direction" type="button" onclick={() => onPageChange(page - 1)} disabled={disabled || page <= 1} aria-label="Halaman sebelumnya">←</button>
    {#if visiblePages[0] > 1}
      <button class="page-button" type="button" onclick={() => onPageChange(1)} disabled={disabled}>1</button>
      {#if visiblePages[0] > 2}<span class="ellipsis" aria-hidden="true">…</span>{/if}
    {/if}
    {#each visiblePages as pageNumber (pageNumber)}
      <button class:active={pageNumber === page} class="page-button" type="button" onclick={() => onPageChange(pageNumber)} disabled={disabled} aria-current={pageNumber === page ? 'page' : undefined}>{pageNumber}</button>
    {/each}
    {#if visiblePages[visiblePages.length - 1] < totalPages}
      {#if visiblePages[visiblePages.length - 1] < totalPages - 1}<span class="ellipsis" aria-hidden="true">…</span>{/if}
      <button class="page-button" type="button" onclick={() => onPageChange(totalPages)} disabled={disabled}>{totalPages}</button>
    {/if}
    <button class="page-button direction" type="button" onclick={() => onPageChange(page + 1)} disabled={disabled || page >= totalPages} aria-label="Halaman berikutnya">→</button>
  </nav>
{/if}

<style>
  .pagination { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 22px 0 0; }
  .page-button { display: inline-grid; place-items: center; min-width: 36px; height: 36px; border: 1px solid #d6e1d5; border-radius: 7px; background: #fff; color: #39754b; padding: 0 9px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: border-color .16s, background-color .16s, color .16s; }
  .page-button:hover:not(:disabled):not(.active) { border-color: #77a87b; background: #f4faf2; }
  .page-button.active { border-color: #39754b; background: #39754b; color: #fff; }
  .page-button.direction { font-size: 17px; }
  .page-button:disabled { cursor: not-allowed; opacity: .45; }
  .page-button:focus-visible { outline: 3px solid #5c95684d; outline-offset: 2px; }
  .ellipsis { color: #718077; padding: 0 2px; }
  @media (max-width: 380px) { .pagination { gap: 4px; }.page-button { min-width: 32px; height: 34px; padding: 0 7px; } }
</style>
