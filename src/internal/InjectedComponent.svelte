<!-- component.props should be considered immutable and to update the component props user has to update the instance -->
<svelte:options immutable={true} />

<script>
	export let component;
	export let props;

	// Workaround for forwarding events
	// See: https://github.com/sveltejs/svelte/issues/2837#issuecomment-1216541560
	import {createEventDispatcher, onMount, onDestroy} from 'svelte';
	import {listen} from 'svelte/internal';
	const dispatch = createEventDispatcher();

	const events = (props['on:'] || []);
	const destructors = []; // (() => void)[]

	function forwardEvent(e) {
		if (component.handle) {
			component.handle(e);
		}
	}

	onMount(() => {
		const ref = component.instance

		if (ref instanceof Element) {
			events.forEach((event) => {
				destructors.push(listen(ref, event, forwardEvent));
			});
		} else {
			events.forEach((event) => {
				destructors.push(ref.$on(event, forwardEvent));
			});
		}
	});

	onDestroy(() => {
		while (destructors.length) {
			destructors.pop()();
		}
	});
</script>

<svelte:component this={component.Component} bind:this={component.instance} {...props}  />
