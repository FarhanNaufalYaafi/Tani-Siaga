import { writable } from 'svelte/store';

export type DialogTone = 'info' | 'success' | 'warning' | 'error';
export type DialogKind = 'alert' | 'confirm' | 'input';

export interface DialogOptions {
	kind: DialogKind;
	title: string;
	message: string;
	tone: DialogTone;
	confirmLabel: string;
	cancelLabel: string;
	input?: {
		label: string;
		type?: 'text' | 'number';
		value?: string;
		placeholder?: string;
		min?: number;
		step?: number;
		required?: boolean;
	};
}

type DialogResult = boolean | string | null | undefined;
type PendingDialog = {
	options: DialogOptions;
	resolve: (result: DialogResult) => void;
};

export const activeDialog = writable<DialogOptions | null>(null);

let active: PendingDialog | null = null;
const queue: PendingDialog[] = [];

function enqueue(options: DialogOptions): Promise<DialogResult> {
	return new Promise((resolve) => {
		const request = { options, resolve };
		if (active) {
			queue.push(request);
			return;
		}
		active = request;
		activeDialog.set(options);
	});
}

export function resolveDialog(result: DialogResult) {
	active?.resolve(result);
	active = queue.shift() || null;
	activeDialog.set(active?.options || null);
}

export function showAlert(
	message: string,
	options: { title?: string; tone?: DialogTone; confirmLabel?: string } = {},
): Promise<void> {
	return enqueue({
		kind: 'alert',
		title: options.title || 'Informasi',
		message,
		tone: options.tone || 'info',
		confirmLabel: options.confirmLabel || 'Mengerti',
		cancelLabel: '',
	}).then(() => undefined);
}

export function showConfirm(
	message: string,
	options: { title?: string; tone?: DialogTone; confirmLabel?: string; cancelLabel?: string } = {},
): Promise<boolean> {
	return enqueue({
		kind: 'confirm',
		title: options.title || 'Konfirmasi',
		message,
		tone: options.tone || 'warning',
		confirmLabel: options.confirmLabel || 'Ya, lanjutkan',
		cancelLabel: options.cancelLabel || 'Batal',
	}).then((result) => result === true);
}

export function showInput(options: {
	title: string;
	message: string;
	input: NonNullable<DialogOptions['input']>;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: DialogTone;
}): Promise<string | null> {
	return enqueue({
		kind: 'input',
		title: options.title,
		message: options.message,
		tone: options.tone || 'info',
		confirmLabel: options.confirmLabel || 'Konfirmasi',
		cancelLabel: options.cancelLabel || 'Batal',
		input: options.input,
	}).then((result) => (typeof result === 'string' ? result : null));
}