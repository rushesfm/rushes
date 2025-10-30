import { createServerClient } from '@supabase/ssr';
import type { RequestEvent } from '@sveltejs/kit';

const SUPABASE_URL_KEY = 'PUBLIC_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'PUBLIC_SUPABASE_ANON_KEY';

function resolveEnvValue(
	event: Pick<RequestEvent, 'platform'>,
	key: typeof SUPABASE_URL_KEY | typeof SUPABASE_ANON_KEY
): string | undefined {
	// Check platform.env first (Cloudflare Pages/Workers)
	const platformEnv = event.platform?.env as Record<string, string | undefined> | undefined;
	if (platformEnv?.[key]) {
		return platformEnv[key];
	}

	// Check process.env (Node.js/Vite dev server)
	if (typeof process !== 'undefined' && process.env?.[key]) {
		return process.env[key];
	}

	// For PUBLIC_ prefixed vars, try import.meta.env (Vite)
	if (typeof globalThis !== 'undefined' && 'VITE_PUBLIC_SUPABASE_URL' in globalThis) {
		const env = (globalThis as any).import?.meta?.env;
		if (env?.[key]) {
			return env[key];
		}
	}

	return undefined;
}

export function createSupabaseServerClient(event: RequestEvent) {
	const supabaseUrl = resolveEnvValue(event, SUPABASE_URL_KEY);
	const supabaseAnonKey = resolveEnvValue(event, SUPABASE_ANON_KEY);

	console.log('Supabase env check:', {
		hasUrl: !!supabaseUrl,
		hasKey: !!supabaseAnonKey,
		platformEnv: !!event.platform?.env,
		processEnv: typeof process !== 'undefined' && !!process.env[SUPABASE_ANON_KEY]
	});

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing Supabase environment variables');
	}

	return createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			get(key: string) {
				return event.cookies.get(key);
			},
			set(key: string, value: string, options) {
				event.cookies.set(key, value, { ...options, path: '/' });
			},
			remove(key: string, options) {
				event.cookies.delete(key, { ...options, path: '/' });
			}
		}
	});
}
