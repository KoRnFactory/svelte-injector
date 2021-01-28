<script>
	import { components } from "../stores";
	import Portal from "./Portal";
</script>

{#each $components as component}
	{#if component.toRender}
		<Portal target={component.domElement} onChildMount={() => component.onMount()}>
			<svelte:component this={component.Component} bind:this={component.instance} {...component.props} />
		</Portal>
	{/if}
{/each}
