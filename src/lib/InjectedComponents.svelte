<script lang="ts">
	import { components } from '$lib/stores.js';
	import InjectedComponent from '$lib/internal/InjectedComponent.svelte';
	import type { SvelteElement } from '$lib/SvelteInjector.js';
	import type { SvelteComponent } from 'svelte';

	function handleMount(instance: SvelteComponent, component: SvelteElement) {
		component.instance = instance;
		component.onMount();
	}
</script>

{#each $components as component (component.index)}
	{#if component && component.toRender}
		<InjectedComponent
			Component={component.Component}
			domElement={component.domElement}
			props={component.props}
			on:mount={(e) => handleMount(e.detail, component)}
		/>
	{/if}
{/each}
