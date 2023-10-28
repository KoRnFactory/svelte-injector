import { writable } from 'svelte/store';
import type { SvelteElement } from './SvelteInjector.js';

export let components = writable([] as SvelteElement[]);
