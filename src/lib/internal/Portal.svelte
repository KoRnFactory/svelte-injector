<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	export let target = document.body;
	export let onChildMount = () => {};
	let ref: HTMLDivElement;

	onMount(() => {
		target.appendChild(ref);
		onChildMount();
	});

	onDestroy(() => {
		if (target.contains(ref)) {
			target.removeChild(ref);
		}
	});
</script>

<div style="display: none">
	<div class="portal" bind:this={ref}>
		<slot />
	</div>
</div>

<style>
	.portal {
		display: contents;
	}
</style>
