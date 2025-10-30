import { browser } from '$app/environment';
import { afterNavigate } from '$app/navigation';
import { onDestroy, onMount } from 'svelte';

export function trackDirectLoad(update: (wasDirect: boolean) => void) {
	if (!browser) {
		update(false);
		return;
	}

	let hasMounted = false;
	let pending: boolean | null = null;

	const dispatch = (value: boolean) => {
		if (hasMounted) {
			update(value);
		} else {
			pending = value;
		}
	};

	const unsubscribe = afterNavigate(({ from }) => {
		dispatch(!from);
	});

	onMount(() => {
		hasMounted = true;
		if (pending !== null) {
			update(pending);
			pending = null;
		}
	});

	onDestroy(() => {
		unsubscribe();
	});
}
