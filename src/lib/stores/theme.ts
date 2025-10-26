import { browser } from '$app/environment';
import { writable } from 'svelte/store';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'rushes-theme';
const store = writable<Theme>('light');

function applyTheme(next: Theme) {
	if (!browser) return;
	const root = document.documentElement;
	root.classList.toggle('dark', next === 'dark');
	root.dataset.theme = next;
	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch (error) {
		console.warn('Unable to persist theme preference', error);
	}
}

function detectPreferredTheme(): Theme {
	if (!browser) return 'light';
	const stored = (() => {
		try {
			const value = localStorage.getItem(STORAGE_KEY);
			return value === 'dark' || value === 'light' ? value : null;
		} catch {
			return null;
		}
	})();
	if (stored) return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = {
	subscribe: store.subscribe,
	/**
	 * Synchronise the theme store with persisted preference and system defaults.
	 */
	init() {
		const initial = detectPreferredTheme();
		store.set(initial);
		applyTheme(initial);
	},
	set(value: Theme) {
		store.set(value);
		applyTheme(value);
	},
	toggle() {
		store.update((current) => {
			const next: Theme = current === 'dark' ? 'light' : 'dark';
			applyTheme(next);
			return next;
		});
	}
};

export type ThemeStore = typeof theme;
