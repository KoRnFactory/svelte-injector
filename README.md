# svelte-injector

Tool to integrate svelte components into other frontend frameworks


# Installing

```sh
npm install --save-dev svelte-injector
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
    import { InjectedComponents } from "svelte-injector";
</script>

<InjectedComponents/>
```
Use `svelte-loader` or `rollup-plugin-svelte` in your bundler. NOT excluding `node_modules`

## Injecting Components
### Imported components
Import the component class into your framework controller, then use `createElement()` to create it.
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

then in your controller use `createLinkedElement()`
```typescript
SvelteInjector.createLinkedElement(target, 'hello', props);
```

### Template parsing
if you have multiple components under a controller you can use `syncTemplate`

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

# Framework integration
This project was created to easily migrate apps from AngularJs to Svelte, but it is not framework specific.

Svelte components should NOT be aware of the fact that they were used by another framework.
## AngularJs
Use `SvelteInjector` functions at the end of the `$onInit` or `$onChanges` lifecycle methods

For performance reasons it is recommended that these funcions are wrapped by a `$timeout`

### createElement()

```typescript
import SvelteInjector from "svelte-injector";
import Component from "src/Component.svelte"

$onInit()
{
    //Your onInit

    let props = {
        name: "world"
    }

    this.$timeout(async () => {
        this.svelteChild = await SvelteInjector.createElement(this.$element[0], Component, props);
    });
}
```

### createLinkedElement()
`index.module.ts`

```typescript
import SvelteInjector from "svelte-injector";
import Component from "src/Component.svelte"

SvelteInjector.link('component-name', Component);
```
Then in your controller:
```typescript
import SvelteInjector from "svelte-injector";

$onInit(){
    //Your onInit
    
    let props = {
        name: "world"
    }
    
    this.$timeout(async () => {
        this.svelteChild = await SvelteInjector.createLinkedElement(this.$element[0], 
            'component-name', props);
    });
}
```

### syncTemplate()
The `$onChanges` function won't be triggered if your INTERNAL state has changed. Only if your component props have.
If your component uses internal state management, put the above snippet at the end of every state management function.

<i>WARNING: if an angular element with an ng-if has a svelte child, it will create a new component every time the ng-if expression is evaluated to true.
Use "toRender" prop if you want to reuse the component.</i>

####1. Use the funcion in a recurring lifecycle method
```typescript
this.svelteChildren = await SvelteInjector.syncTemplate(this.$element[0]);
```
####2. Use the component in your markup like so:
```html
<div data-component-name="hello" data-props='{"name": "world"}'></div>

Conditional rendering: you can use {data-to-render} as the condition in an {#if} 
<div data-component-name="hello" data-props='{"name": "world"}' data-to-render"'true'"></div>
```
<b>Don't forget</b> to use `destroyAll()` in your `$onDestroy` to optimize memory usage

### createElementsFromTemplate()
Is exactly like `syncTemplate()` but is made for a one time run only.

# License

[MIT](LICENSE)
