export function isStrongPassword(value: string): boolean {
	return value.length >= 8
		&& /[a-z]/.test(value)
		&& /[A-Z]/.test(value)
		&& /\d/.test(value)
		&& /[^A-Za-z0-9]/.test(value);
}

export const PASSWORD_REQUIREMENTS = 'Minimal 8 karakter, dengan huruf besar, huruf kecil, angka, dan simbol.';