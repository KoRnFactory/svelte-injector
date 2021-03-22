<script>
    export let component;
</script>

<svelte:component this={component.Component} bind:this={component.instance} {...component.props} />
