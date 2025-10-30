import type { RequestEvent } from '@sveltejs/kit';

type EnvSource = Record<string, string | undefined> | undefined;

const ENV_KEYS = ['INVITE_CODES', 'ACCOUNT_INVITE_CODES'] as const;

function getEnv(event: Pick<RequestEvent, 'platform'>): EnvSource {
	const platformEnv = event.platform?.env as Record<string, string | undefined> | undefined;
	if (platformEnv) return platformEnv;
	if (typeof process !== 'undefined') {
		return process.env as Record<string, string | undefined>;
	}
	return undefined;
}

export function parseInviteCodes(raw: string | undefined): string[] {
	if (!raw) return [];
	return raw
		.split(/[,\s]+/)
		.map((code) => code.trim())
		.filter((code) => code.length > 0);
}

export function getInviteCodes(event: Pick<RequestEvent, 'platform'>): string[] {
	const env = getEnv(event);
	if (!env) return [];
	for (const key of ENV_KEYS) {
		const value = env[key];
		if (value) {
			return parseInviteCodes(value);
		}
	}
	return [];
}

export function inviteCodesEnabled(event: Pick<RequestEvent, 'platform'>): boolean {
	return getInviteCodes(event).length > 0;
}

export function validateInviteCode(
	event: Pick<RequestEvent, 'platform'>,
	code: string | undefined | null
): { valid: boolean; error?: string } {
	const trimmed = typeof code === 'string' ? code.trim() : '';
	const codes = getInviteCodes(event);

	if (codes.length === 0) {
		return {
			valid: false,
			error:
				'Invite codes are not configured. Please add INVITE_CODES to your environment to enable signups.'
		};
	}

	if (trimmed.length === 0) {
		return { valid: false, error: 'An invite code is required to create an account.' };
	}

	if (!codes.includes(trimmed)) {
		return { valid: false, error: 'Invalid invite code. Please check your code and try again.' };
	}

	return { valid: true };
}
