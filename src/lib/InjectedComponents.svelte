<script lang="ts">
	import { components } from '$lib/stores.js';
	import InjectedComponent from '$lib/internal/InjectedComponent.svelte';
</script>

{#each $components as component (component.index)}
	{#if component && component.toRender}
		<InjectedComponent
			Component={component.Component}
			domElement={component.domElement}
			props={component.props}
			on:mount={component.onMount}
		/>
	{/if}
{/each}
