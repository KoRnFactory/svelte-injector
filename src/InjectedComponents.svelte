<script>
	import { components } from "./stores";
	import Portal from "./internal/Portal.svelte";
	import InjectedComponent from "./internal/InjectedComponent.svelte";
</script>

{#each $components as component (component.index)}
	{#if component && component.toRender}
		<Portal target={component.domElement} onChildMount={() => component.onMount()}>
			<InjectedComponent {component} />
		</Portal>
	{/if}
{/each}
