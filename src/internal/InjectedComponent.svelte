<!-- component.props should be considered immutable and to update the component props user has to update the instance -->
<svelte:options immutable={true} />

<script>
	export let component;
	export let props;
</script>

<svelte:component this={component.Component} bind:this={component.instance} {...props} />
