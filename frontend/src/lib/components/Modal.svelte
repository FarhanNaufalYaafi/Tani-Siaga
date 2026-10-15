<script lang="ts">
	import { activeDialog, resolveDialog, type DialogTone } from '$lib/services/dialog';

	let inputValue = $state('');
	let inputError = $state('');
	let inputValues = $state<string[]>([]);
	let inputErrors = $state<string[]>([]);
	let dialogInputs = $derived($activeDialog?.inputs || ($activeDialog?.input ? [$activeDialog.input] : []));
	const dialogToneClasses: Record<DialogTone, string> = {
		info: 'informasi',
		success: 'berhasil',
		warning: 'peringatan',
		error: 'galat',
	};

	$effect(() => {
		inputValue = $activeDialog?.input?.value || '';
		inputError = '';
		inputValues = dialogInputs.map((input) => input.value || '');
		inputErrors = dialogInputs.map(() => '');
	});

	function dismiss() {
		resolveDialog($activeDialog?.kind === 'confirm' ? false : null);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if ($activeDialog?.kind === 'input') {
			const values = $activeDialog.inputs ? inputValues : [inputValue];
			const errors = dialogInputs.map((input, index) => {
				const value = values[index]?.trim() || '';
				if (input.required && !value) return 'Kolom ini wajib diisi.';
				if (input.type !== 'number' || !value) return '';
				const numericValue = Number(value);
				if (!Number.isFinite(numericValue)) return 'Masukkan angka yang valid.';
				if (input.min !== undefined && numericValue < input.min) return `Nilai minimal ${input.min}.`;
				if (input.step && Math.abs((numericValue - (input.min || 0)) / input.step - Math.round((numericValue - (input.min || 0)) / input.step)) > 1e-9) return `Masukkan kelipatan ${input.step}.`;
				return '';
			});
			if ($activeDialog.inputs) inputErrors = errors;
			else inputError = errors[0] || '';
			if (errors.some(Boolean)) return;
			if ($activeDialog.inputs) resolveDialog(inputValues);
			else resolveDialog(inputValue);
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
	<div class="latar-dialog" role="presentation">
		<dialog open class={`kartu-dialog ${dialogToneClasses[$activeDialog.tone]}`} aria-labelledby="judul-dialog" aria-describedby="pesan-dialog">
			<div class="judul-dialog">
				<span class="simbol-dialog" aria-hidden="true">
					{$activeDialog.tone === 'success' ? '✓' : $activeDialog.tone === 'error' ? '!' : $activeDialog.tone === 'warning' ? '?' : 'i'}
				</span>
				<div>
					<p class="label-dialog">TANI SIAGA</p>
					<h2 id="judul-dialog">{$activeDialog.title}</h2>
				</div>
				<button class="tutup-dialog" type="button" aria-label="Tutup" onclick={dismiss}>×</button>
			</div>
			<p class="pesan-dialog" id="pesan-dialog">{$activeDialog.message}</p>
			<form novalidate onsubmit={submit}>
				{#if $activeDialog.kind === 'input'}
					{#each dialogInputs as input, index (index)}
						<label class="label-masukan-dialog">
							{input.label}
							<input
								type={input.type || 'text'}
								value={$activeDialog.inputs ? inputValues[index] : inputValue}
								placeholder={input.placeholder}
								min={input.type === 'number' ? input.min : undefined}
								step={input.type === 'number' ? input.step : undefined}
								aria-invalid={Boolean($activeDialog.inputs ? inputErrors[index] : inputError)}
								oninput={(event) => {
									if ($activeDialog.inputs) {
										inputValues[index] = event.currentTarget.value;
										inputErrors[index] = '';
									} else {
										inputValue = event.currentTarget.value;
										inputError = '';
									}
								}}
							/>
							{#if $activeDialog.inputs && inputErrors[index]}<small class="galat-masukan-dialog">{inputErrors[index]}</small>{/if}
							{#if !$activeDialog.inputs && inputError}<small class="galat-masukan-dialog">{inputError}</small>{/if}
						</label>
					{/each}
				{/if}
				<div class="aksi-dialog">
					{#if $activeDialog.kind !== 'alert'}
						<button class="batal-dialog" type="button" onclick={dismiss}>{$activeDialog.cancelLabel}</button>
					{/if}
					<button class:bahaya={$activeDialog.tone === 'error' || $activeDialog.tone === 'warning'} class="konfirmasi-dialog" type="submit">
						{$activeDialog.confirmLabel}
					</button>
				</div>
			</form>
		</dialog>
	</div>
{/if}

<style>
	.latar-dialog {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 20px;
		background: #12271db8;
		animation: masuk-latar .16s ease-out;
	}
	.kartu-dialog {
		position: relative;
		width: min(100%, 460px);
		margin: 0;
		border: 1px solid #d6e1d5;
		border-radius: 12px;
		padding: 25px;
		background: #fff;
		color: #183126;
		box-shadow: 0 24px 70px #12271d45;
		animation: masuk-dialog .2s ease-out;
	}
	.judul-dialog {
		display: grid;
		grid-template-columns: 38px 1fr auto;
		align-items: center;
		gap: 12px;
	}
	.simbol-dialog {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: #eaf4e9;
		color: #39754b;
		font: 800 18px 'DM Sans', sans-serif;
	}
	.kartu-dialog.peringatan .simbol-dialog {
		background: #fff4dc;
		color: #a8762e;
	}
	.kartu-dialog.galat .simbol-dialog {
		background: #fff0ef;
		color: #a44242;
	}
	.label-dialog {
		margin: 0 0 4px;
		color: #718077;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: .14em;
	}
	.judul-dialog h2 {
		margin: 0;
		font: 600 22px/1.15 'Fraunces', Georgia, serif;
	}
	.tutup-dialog {
		border: 0;
		background: transparent;
		color: #718077;
		font-size: 24px;
		line-height: 1;
		cursor: pointer;
	}
	.pesan-dialog {
		margin: 18px 0 0;
		color: #52705a;
		font-size: 14px;
		line-height: 1.55;
		white-space: pre-line;
	}
	.label-masukan-dialog {
		display: grid;
		gap: 7px;
		margin-top: 20px;
		color: #385540;
		font-size: 12px;
		font-weight: 700;
	}
	.label-masukan-dialog input {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid #d6e1d5;
		border-radius: 7px;
		padding: 12px;
		background: #fbfdfb;
		color: #183126;
		font: inherit;
		outline: 0;
	}
	.label-masukan-dialog input:focus {
		border-color: #39754b;
		box-shadow: 0 0 0 3px #39754b1c;
	}
	.label-masukan-dialog input[aria-invalid="true"] {
		border-color: #c9514b;
	}
	.galat-masukan-dialog {
		color: #a44242;
		font-size: 11px;
		font-weight: 500;
	}
	.aksi-dialog {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 9px;
		margin-top: 24px;
	}
	.aksi-dialog button {
		border-radius: 6px;
		padding: 10px 13px;
		font: 700 12px 'DM Sans', sans-serif;
		cursor: pointer;
	}
	.batal-dialog {
		border: 1px solid #a9c9aa;
		background: #fff;
		color: #39754b;
	}
	.konfirmasi-dialog {
		border: 1px solid #39754b;
		background: #39754b;
		color: #fff;
	}
	.konfirmasi-dialog.bahaya {
		border-color: #a44242;
		background: #a44242;
	}
	@keyframes masuk-latar {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes masuk-dialog {
		from {
			opacity: 0;
			transform: translateY(8px) scale(.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@media (max-width: 520px) {
		.kartu-dialog {
			padding: 21px;
		}
		.judul-dialog h2 {
			font-size: 20px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.latar-dialog, .kartu-dialog {
			animation: none;
		}
	}
</style>
