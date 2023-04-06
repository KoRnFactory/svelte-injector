<!-- component.props should be considered immutable and to update the component props user has to update the instance -->
<svelte:options immutable={true} />

<script context="module">
	let context;
</script>

<script>
	import { createEventDispatcher, getAllContexts, onMount } from "svelte";

	export let Component;
	export let domElement;
	export let props;

	$: if (instance) instance.$set(props);

	if (!context) {
		context = getAllContexts();
	}

	let instance = new Component({ target: domElement, props: props, context });

	const dispatch = createEventDispatcher();

	onMount(() => {
		dispatch("mount", instance);

		return () => {
			instance.$destroy();
			dispatch("destroy", instance);
		};
	});
</script>
