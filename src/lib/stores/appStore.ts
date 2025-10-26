import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { gsap } from 'gsap/dist/gsap';
import Flip from 'gsap/dist/Flip';

interface UiState {
	isExpanded: boolean;
}

const store = writable<UiState>({ isExpanded: false });

type LayoutClass = 'fullscreen' | 'sidebar';

let flipRegistered = false;

function getScrollContainer() {
	return document.querySelector('#scroll-content') as HTMLElement | null;
}

function getSidebarDetails() {
	return document.querySelector('#sidebar-details') as HTMLElement | null;
}

function setScrollContainerMode(layout: LayoutClass) {
	const scroller = getScrollContainer();
	if (!scroller) return;
	scroller.classList.add('overflow-y-auto');
	scroller.dataset.layout = layout;
}

function ensureFlipRegistered() {
	if (!flipRegistered) {
		gsap.registerPlugin(Flip);
		flipRegistered = true;
	}
}

function getCurrentLayout(container: HTMLElement): LayoutClass | null {
	if (container.classList.contains('fullscreen')) return 'fullscreen';
	if (container.classList.contains('sidebar')) return 'sidebar';
	return null;
}

function updateLayoutClass(isExpanded: boolean) {
	if (!browser) return;
	const container = document.getElementById('player-container');
	if (!container) return;

	ensureFlipRegistered();

	const nextLayout: LayoutClass = isExpanded ? 'fullscreen' : 'sidebar';
	const previousLayout = getCurrentLayout(container);

	const scroller = getScrollContainer();
	const details = getSidebarDetails();
	const flipTargets = details ? [container, details] : container;

	if (previousLayout === nextLayout) {
		container.classList.remove('fullscreen', 'sidebar');
		container.classList.add(nextLayout);
		if (scroller) {
			setScrollContainerMode(nextLayout);
		}
		return;
	}

	const state = Flip.getState(flipTargets);

	let restoreScroll: (() => void) | null = null;
	if (scroller) {
		const { overflow, overflowX, overflowY } = scroller.style;
		scroller.classList.remove('overflow-y-auto');
		scroller.style.overflow = 'visible';
		let restored = false;
		restoreScroll = () => {
			if (restored) return;
			restored = true;
			scroller.style.overflow = overflow;
			scroller.style.overflowX = overflowX;
			scroller.style.overflowY = overflowY;
			setScrollContainerMode(nextLayout);
		};
	}

	container.classList.remove('fullscreen', 'sidebar');
	container.classList.add(nextLayout);

	const finalize = () => {
		if (restoreScroll) restoreScroll();
		else setScrollContainerMode(nextLayout);
	};

	Flip.from(state, {
		absolute: true,
		duration: 0.38,
		ease: 'power2.inOut',
		onComplete: finalize,
		onInterrupt: finalize
	});
}

export const actions = {
	toggleMode() {
		store.update((current) => {
			const next = { ...current, isExpanded: !current.isExpanded };
			updateLayoutClass(next.isExpanded);
			return next;
		});
	},
	setExpanded(value: boolean) {
		store.update((current) => {
			if (current.isExpanded === value) return current;
			const next = { ...current, isExpanded: value };
			updateLayoutClass(next.isExpanded);
			return next;
		});
	}
};

export const uiState = {
	subscribe: store.subscribe,
	set(value: UiState) {
		store.set(value);
		updateLayoutClass(value.isExpanded);
	},
	update(updater: (state: UiState) => UiState) {
		store.update((state) => {
			const next = updater(state);
			updateLayoutClass(next.isExpanded);
			return next;
		});
	}
};
