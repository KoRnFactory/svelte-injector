<script>
  import { onMount, onDestroy } from 'svelte'
  export let target = document.body;
  export let onChildMount = () => {};
  let ref;

  onMount(() => {
    target.appendChild(ref)
    onChildMount();
  })

  onDestroy(() => {
    if(target.contains(ref)){
      target.removeChild(ref)
    }
  })

</script>

<div style="display: none">
  <div class="portal" bind:this={ref}>
    <slot></slot>
  </div>
</div>
<style>
    .portal { display: contents; }
</style>
