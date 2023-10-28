<svelte:options immutable={true} />

<script lang="ts" generics="C extends import('svelte').SvelteComponent">
	import {
		type ComponentProps,
		type ComponentType,
		createEventDispatcher,
		getAllContexts,
		onMount
	} from 'svelte';

	export let Component: ComponentType<C>;
	export let domElement: HTMLElement;
	export let props: ComponentProps<C>;

	$: updateComponent(Component, domElement);
	$: updateProps(props);

	let context = getAllContexts();
	let instance: C;

	const dispatch = createEventDispatcher();

	onMount(() => {
		dispatch('mount', instance);

		return () => {
			instance.$destroy();
			dispatch('destroy', instance);
		};
	});

	function updateComponent(Component: ComponentType<C>, domElement: HTMLElement) {
		if (instance) instance.$destroy();
		instance = new Component({ target: domElement, props: props, context });
	}

	function updateProps(props: ComponentProps<C>) {
		if (instance) instance.$set(props);
	}
</script>
