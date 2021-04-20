<!-- Prevent the component props being resetted when another component as been linked into InjectedComponents -->
<!-- component.props should be considered immutable and to update the component props user has to update the instance -->
<svelte:options immutable={true} />

<script>
    export let component;
</script>

<svelte:component this={component.Component} bind:this={component.instance} {...component.props} />
