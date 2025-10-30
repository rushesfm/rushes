import { createBrowserClient } from '@supabase/ssr';
import { browser } from '$app/environment';

const SUPABASE_URL_KEY = 'PUBLIC_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'PUBLIC_SUPABASE_ANON_KEY';

export function createSupabaseClient() {
	if (!browser) {
		throw new Error('createSupabaseClient can only be used in the browser');
	}

	const supabaseUrl = import.meta.env[SUPABASE_URL_KEY];
	const supabaseAnonKey = import.meta.env[SUPABASE_ANON_KEY];

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing Supabase environment variables');
	}

	return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
