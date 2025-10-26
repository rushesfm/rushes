import { writable } from 'svelte/store';

export interface AuthUser {
	id: string;
	name: string;
	email: string;
	avatarUrl?: string;
}

interface AuthState {
	user: AuthUser | null;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({ user: null });

	return {
		subscribe,
		login(user: AuthUser) {
			set({ user });
		},
		logout() {
			set({ user: null });
		},
		updateUser(updater: (user: AuthUser) => AuthUser) {
			update((state) => {
				if (!state.user) return state;
				return { user: updater(state.user) };
			});
		}
	};
}

export const authStore = createAuthStore();
