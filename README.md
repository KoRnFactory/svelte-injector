# svelte-injector

Tool to integrate svelte components into other frontend frameworks


# Installing

For the latest stable version, run:

## npm

```sh
npm install svelte-injector
```

# Usage
## Setup
Create your Svelte App: --> [reference](https://svelte.dev/tutorial/making-an-app)

`src/svelte/main.js`
```typescript
import App from './App.svelte'

const svelteEntrypoint = document.createElement("div");
svelteEntrypoint.id = "svelte-entrypoint";
document.body.prepend(svelteEntrypoint);

// Create Svelte App
new App({
    target: svelteEntrypoint,
});
```
Note: since Svelte needs to share the DOM with your existing app you can't use `document.body` as a target.

`App.svelte`
```sveltehtml
<script>
    import InjectedComponents from "svelte-injector/InjectedComponents.svelte";
</script>

<InjectedComponents/>
```
Use `svelte-loader` or `rollup-plugin-svelte` in your bundler. NOT excluding `node_modules`

## Injecting Components
### Imported components
Import the component class into your framework controller, then use Svelte-Injector to create it.
```typescript
import Hello from "./Hello.svelte"

SvelteInjector.createElement(target, Hello, props);
```

### Linked components
Link component class with a string to use it everywhere

in your index.module
```typescript
import Hello from "./Hello.svelte"

SvelteInjector.link(target, 'hello', Hello);
```

then in your controller
```typescript
SvelteInjector.createLinkedElement(target, 'hello', props);
```

### Sync Template
if you have multiple components under a controller you can use `syncTemplate` function.

Use this notation in the template:
```html
<div data-component-name="hello" data-props='{"name": "world"}'></div>
```
Then call `syncTemplate` to update the components tree in Svelte.
```typescript
SvelteInjector.syncTemplate(target);
```

You can use `data-to-render` attribute as an `{if}` block in Svelte

```html
<div data-component-name="hello" data-props='{"name": "world"}' data-to-render"true"></div>
```

# License

[MIT](LICENSE)
