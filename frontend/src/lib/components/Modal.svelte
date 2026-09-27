<script lang="ts">
	import { activeDialog, resolveDialog } from '$lib/services/dialog';

	let inputValue = $state('');
	let inputError = $state('');

	$effect(() => {
		inputValue = $activeDialog?.input?.value || '';
		inputError = '';
	});

	function dismiss() {
		resolveDialog($activeDialog?.kind === 'confirm' ? false : null);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if ($activeDialog?.kind === 'input') {
			const input = $activeDialog.input;
			const value = inputValue.trim();
			if (input?.required && !value) {
				inputError = 'Kolom ini wajib diisi.';
				return;
			}
			if (input?.type === 'number') {
				const numericValue = Number(value);
				if (!Number.isFinite(numericValue)) {
					inputError = 'Masukkan angka yang valid.';
					return;
				}
				if (input.min !== undefined && numericValue < input.min) {
					inputError = `Nilai minimal ${input.min}.`;
					return;
				}
				if (input.step && Math.abs((numericValue - (input.min || 0)) / input.step - Math.round((numericValue - (input.min || 0)) / input.step)) > 1e-9) {
					inputError = `Masukkan kelipatan ${input.step}.`;
					return;
				}
			}
			resolveDialog(inputValue);
		} else {
			resolveDialog($activeDialog?.kind === 'confirm');
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && $activeDialog) {
			event.preventDefault();
			dismiss();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if $activeDialog}
	<div class="dialog-backdrop" role="presentation">
		<dialog open class={`dialog-card ${$activeDialog.tone}`} aria-labelledby="dialog-title" aria-describedby="dialog-message">
			<div class="dialog-heading">
				<span class="dialog-symbol" aria-hidden="true">
					{$activeDialog.tone === 'success' ? '✓' : $activeDialog.tone === 'error' ? '!' : $activeDialog.tone === 'warning' ? '?' : 'i'}
				</span>
				<div>
					<p class="dialog-kicker">TANI SIAGA</p>
					<h2 id="dialog-title">{$activeDialog.title}</h2>
				</div>
				<button class="dialog-close" type="button" aria-label="Tutup" onclick={dismiss}>×</button>
			</div>
			<p class="dialog-message" id="dialog-message">{$activeDialog.message}</p>
			<form novalidate onsubmit={submit}>
				{#if $activeDialog.kind === 'input' && $activeDialog.input}
					<label class="dialog-input-label">
						{$activeDialog.input.label}
						<input
							type={$activeDialog.input.type || 'text'}
							value={inputValue}
							placeholder={$activeDialog.input.placeholder}
							aria-invalid={Boolean(inputError)}
							oninput={(event) => { inputValue = event.currentTarget.value; inputError = ''; }}
						/>
						{#if inputError}<small class="dialog-input-error">{inputError}</small>{/if}
					</label>
				{/if}
				<div class="dialog-actions">
					{#if $activeDialog.kind !== 'alert'}
						<button class="dialog-cancel" type="button" onclick={dismiss}>{$activeDialog.cancelLabel}</button>
					{/if}
					<button class:danger={$activeDialog.tone === 'error' || $activeDialog.tone === 'warning'} class="dialog-confirm" type="submit">
						{$activeDialog.confirmLabel}
					</button>
				</div>
			</form>
		</dialog>
	</div>
{/if}

<style>
	.dialog-backdrop { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 20px; background: #12271db8; animation: backdrop-in .16s ease-out; }
	.dialog-card { position: relative; width: min(100%, 460px); margin: 0; border: 1px solid #d6e1d5; border-radius: 12px; padding: 25px; background: #fff; color: #183126; box-shadow: 0 24px 70px #12271d45; animation: dialog-in .2s ease-out; }
	.dialog-heading { display: grid; grid-template-columns: 38px 1fr auto; align-items: center; gap: 12px; }
	.dialog-symbol { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: #eaf4e9; color: #39754b; font: 800 18px 'DM Sans', sans-serif; }
	.dialog-card.warning .dialog-symbol { background: #fff4dc; color: #a8762e; }
	.dialog-card.error .dialog-symbol { background: #fff0ef; color: #a44242; }
	.dialog-kicker { margin: 0 0 4px; color: #718077; font-size: 9px; font-weight: 800; letter-spacing: .14em; }
	.dialog-heading h2 { margin: 0; font: 600 22px/1.15 'Fraunces', Georgia, serif; }
	.dialog-close { border: 0; background: transparent; color: #718077; font-size: 24px; line-height: 1; cursor: pointer; }
	.dialog-message { margin: 18px 0 0; color: #52705a; font-size: 14px; line-height: 1.55; white-space: pre-line; }
	.dialog-input-label { display: grid; gap: 7px; margin-top: 20px; color: #385540; font-size: 12px; font-weight: 700; }
	.dialog-input-label input { box-sizing: border-box; width: 100%; border: 1px solid #d6e1d5; border-radius: 7px; padding: 12px; background: #fbfdfb; color: #183126; font: inherit; outline: 0; }
	.dialog-input-label input:focus { border-color: #39754b; box-shadow: 0 0 0 3px #39754b1c; }
	.dialog-input-label input[aria-invalid="true"] { border-color: #c9514b; }
	.dialog-input-error { color: #a44242; font-size: 11px; font-weight: 500; }
	.dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 9px; margin-top: 24px; }
	.dialog-actions button { border-radius: 6px; padding: 10px 13px; font: 700 12px 'DM Sans', sans-serif; cursor: pointer; }
	.dialog-cancel { border: 1px solid #a9c9aa; background: #fff; color: #39754b; }
	.dialog-confirm { border: 1px solid #39754b; background: #39754b; color: #fff; }
	.dialog-confirm.danger { border-color: #a44242; background: #a44242; }
	@keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes dialog-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
	@media (max-width: 520px) { .dialog-card { padding: 21px; }.dialog-heading h2 { font-size: 20px; } }
	@media (prefers-reduced-motion: reduce) { .dialog-backdrop, .dialog-card { animation: none; } }
</style>
