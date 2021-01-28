import App from './App.svelte';
import { AngularToSvelte } from "./AngularToSvelte";

// Creates server side components
AngularToSvelte.createElementsFromTemplate(document.body).then(() => console.log('Server side Svelte components created'));

const svelteEntrypoint = document.createElement("div");
svelteEntrypoint.id = "svelte-entrypoint";
document.body.prepend(svelteEntrypoint);

new App({
  target: svelteEntrypoint,
});
