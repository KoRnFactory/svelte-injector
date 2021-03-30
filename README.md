# Svelte Injector

> Tool to integrate Svelte components into other frontend frameworks

## Features
>
> - **Inject** Svelte components in React, Angular, Vue, jQuery, Vanilla JS.
> - Easily **migrate** to Svelte while keeping older code running.
> - Write **agnostic** Svelte components. _They will never know what hit them_.
> - Uses **Portals** to render components where you want them.
> - The main Svelte App is in your control. Use contexts/store/head/window as you wish.
> - **Typescript** <3

# Table of contents

- [Installing](#installing)
- [Usage](#usage)
  - [Setup](#setup)
  - [Injecting](#injecting-components)
- [Framework Integration](#framework-integration)
  - [AngularJs](#angularjs)
  - [React](#react)
  - [Angular](#angular)
- [JS API](#js-api)
- [Credits](#credits)

# Installing

```sh
npm install --save-dev svelte-injector svelte
```

Then configure your bundler of choice to accept Svelte files.

# Usage

## Setup

Create your Svelte App: --> [reference](https://svelte.dev/tutorial/making-an-app)

`src/svelte/main`

```typescript
import App from "./App.svelte";

const svelteEntrypoint = document.createElement("div");
svelteEntrypoint.id = "svelte-entrypoint";
document.body.prepend(svelteEntrypoint);

// Create Svelte App
new App({
	target: svelteEntrypoint,
});
```

_Note: Svelte needs to share the DOM with your existing app. It's recommended you don't use `document.body` as the App target._

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
import Hello from "./Hello.svelte";

SvelteInjector.createElement(target, Hello, props);
```

### Linked components

Link component class with a string to use it anywhere.

Import your components somewhere in your bundle (es: create an `index.module` file)

```typescript
import Hello from "./Hello.svelte";

SvelteInjector.link(target, "hello", Hello);
```

then in your controller use `createLinkedElement()`

```typescript
SvelteInjector.createLinkedElement(target, "hello", props);
```

### Template parsing

If you have multiple components under a single dom node you can use `syncTemplate`

_However for better performance I'd recommend creating a wrapper component in Svelte and placing an {each} there._

Use this notation in the template:

```html
<div data-component-name="hello">
  <template id="props">
    <!--JSON formatted-->
    {"name": "hello"}
  </template>
</div>
```

Then call `syncTemplate` to update the components tree in Svelte.

```typescript
SvelteInjector.syncTemplate(target);
```

You can use `data-to-render` attribute as an `{if}` block in Svelte

```html
<div data-component-name="hello" data-to-render"'true'">
  <template id="props">
    <!--JSON formatted-->
    {"name": "hello"}
  </template>
</div>
```

### Backend requested components

you can create components that are requested in your source HTML.

If your HTML contains any component markup like so:

```html
<div data-component-name="hello">
  <template id="props">
    <!--JSON formatted-->
    {"name": "hello"}
  </template>
</div>
```

Just run `createElementsFromTemplate()` once to render them.

```typescript
SvelteInjector.createElementsFromTemplate(document.body);
```

_NOTE: the component with the requested name needs to be linked first._

# Framework integration

This project was created to easily migrate apps from AngularJs to Svelte, but it is not framework specific.

Svelte components should NOT be aware of the fact that they were used by another framework.

## AngularJs

Use `SvelteInjector` functions at the end of the `$onInit` or `$onChanges` lifecycle methods

For performance reasons it is recommended that these funcions are wrapped by a `$timeout`

### createElement()

```typescript
import SvelteInjector from "svelte-injector";
import Component from "src/Component.svelte";

$onInit();
{
	//Your onInit

	let props = {
		name: "world",
	};

	this.$timeout(async () => {
		this.svelteChild = await SvelteInjector.createElement(this.$element[0], Component, props);
	});
}
```

### createLinkedElement()

`index.module.ts`

```typescript
import SvelteInjector from "svelte-injector";
import Component from "src/Component.svelte";

SvelteInjector.link("component-name", Component);
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

However for better performance I'd recommend creating a wrapper component in Svelte and placing an {each} there.

_WARNING: if an angular element with an ng-if has a svelte child, it will create a new component every time the ng-if expression is evaluated to true.
Use "toRender" prop if you want to reuse the component._

#### 1. Use the funcion in a recurring lifecycle method

```typescript
this.svelteChildren = await SvelteInjector.syncTemplate(this.$element[0]);
```

#### 2. Use the component in your markup like so:

```html
<div data-component-name="hello">
    <template id="props">
        <!--JSON formatted-->
        {"name": "hello"}
    </template>
</div>

Conditional rendering: you can use {data-to-render} as the condition in an {#if}
<div data-component-name="hello" data-to-render"'true'">
    <template id="props">
        <!--JSON formatted-->
        {"name": "hello"}
    </template>
</div>
```

**Don't forget** to use `destroyAll()` in your `$onDestroy` to optimize memory usage

## React

Documentation refers to **Class Components**, but can be applied to Functional Components with **hooks**.

Use `SvelteInjector` functions at the end of the `componentDidMount` or `componentDidUpdate` lifecycle methods

### createElement()

```typescript
import SvelteInjector from "svelte-injector";
import Component from "src/Component.svelte"

componentDidMount() {
    //Your onInit

    let props = {
        name: "world"
    }

    // You can use async/await too
    SvelteInjector.createElement(ref, Component, props).then(component => {
        this.svelteChild = component;
    });
}
```

### updateProps()

```typescript
componentDidUpdate() {
    this.svelteChild.updateProps({name: "universe"})
}
```

### createLinkedElement()

`index.module.ts`

```typescript
import SvelteInjector from "svelte-injector";
import Component from "src/Component.svelte";

SvelteInjector.link("component-name", Component);
```

Then in your controller:

```typescript
import SvelteInjector from "svelte-injector";

componentDidMount(){
    //Your onInit

    let props = {
        name: "world"
    }

    this.svelteChild = await SvelteInjector.createLinkedElement(ref, 'component-name', props);
}
```

### syncTemplate()

Useful if you need to place many Svelte components in a single div.
Use `syncTemplate()` in your `componentDidUpdate`.

However for better performance I'd recommend creating a wrapper component in Svelte and placing an {each} there.

_WARNING: if an HTMLElement that has a svelte child is rendered conditionally, it will create a new component every time the conditional expression is evaluated to true.
Use "toRender" parameter if you want to reuse the component._

#### 1. Use the funcion in a recurring lifecycle method

```typescript
this.svelteChildren = await SvelteInjector.syncTemplate(ref);
```

#### 2. Use the component in your markup like so:

```typescript jsx
<div data-component-name={"hello"}>
  <template id="props">
    {JSON.stringify(props)}
  </template>
</div>

// Conditional rendering: you can use {data-to-render} as the condition in an {#if}
<div data-component-name={"hello"} data-to-render={true}>
  <template id="props">
    {JSON.stringify(props)}
  </template>
</div>
```

**Don't forget** to use `destroyAll()` in your `componentWillUnmount` to optimize memory usage


## Angular

Docs in progress

# JS API

## Elements

Interface `SvelteElement`

### updateProps(props)

#### props `object`

The new props object. All previous props will be dropped.

### updateToRender(toRender)

#### toRender `boolean`

The new props object.

### destroy()

Destroys the component.

## Injector

### createElement(target, Component, props[,toRender])

#### target `HTMLElement`

The element in which the component will be rendered

#### Component `SvelteComponent`

The Svelte component Class

#### props `object`

An object with props compatible with the Svelte Component

#### toRender `boolean` (default = true)

Boolean that indicates if the component should render immediately.

#### RETURN `Promise<SvelteElement>`

A promise that resolves the `SvelteElement` when the component is mounted or created (when toRender = false)

### createLinkedElement(target, componentName, props[,toRender])

#### target `HTMLElement`

The element in which the component will be rendered

#### componentName `string`

The name of the component as linked with `link()`

#### props `object`

An object with props compatible with the Svelte Component

#### toRender `boolean` (default = true)

Boolean that indicates if the component should render immediately

#### RETURN `Promise<SvelteElement>`

A promise that resolves the `SvelteElement` when the component is mounted or created (when toRender = false)

### syncTemplate(target)

#### target `HTMLElement`

The element in which the components will be looked for.

#### RETURN `Promise<SvelteElement[]>`

A promise array for each created component that resolves the `SvelteElement` when the component is mounted or created (when toRender = false)

_NOTE: this method is NOT synchronous_

### createElementsFromTemplate(target)

#### target `HTMLElement`

The element in which the components will be looked for.

#### RETURN `Promise<SvelteElement[]>`

A promise array for each created component that resolves the `SvelteElement` when the component is mounted or created (when toRender = false)

### findComponentByName(name)

#### name `string`

name of the component as previously linked with `link()`

#### RETURN `typeof SvelteComponent`

The Class of the linked component, if any

### findLinkNameByClass(Class)

#### Class `typeof SvelteComponent`

Class of the component as previously linked with `link()`

#### RETURN `string`

The name of the linked component, if any

# Credits

- [Svelte](https://svelte.dev/)
- Portals implementation was inspired by @romkor's work on [svelte-portal](https://github.com/romkor/svelte-portal).

# License

[MIT](LICENSE)
