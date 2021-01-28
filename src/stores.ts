import { writable } from "svelte/store";
import type { SvelteElement } from "./SvelteInjector";

export let components = writable([] as SvelteElement[]);
