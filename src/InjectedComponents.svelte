<script>
	import { components } from "./stores";
	import InjectedComponent from "./internal/InjectedComponent.svelte";
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
