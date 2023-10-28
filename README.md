# Svelte Injector

> Go Svelte one component at a time

## Features

- Use Svelte components in any framework: React, Angular, Vue, jQuery, Vanilla JS.
- Easily **migrate** to Svelte while keeping older code running.
- Built in **React** and **AngularJS** components for ease of use.
- Write **agnostic** Svelte components. No workarounds needed.
- Renders your components where you want them while keeping the context.
- The Svelte App is in your control. Use _contexts/store/head/window_.
- Support for **dynamic imports** and **lazy loading**.

# Table of contents

- [Installing](#installing)
- [Usage](#usage)
  - [Setup](#setup)
  - [Injecting](#injecting-components)
- [Framework Integration](#framework-integration)
  - [React](#react)
  - [AngularJs](#angularjs)
  - [Angular](#angular)
- [JS API](#js-api)
- [Migrating from earlier versions](#migrating-from-earlier-versions)
  - [Migrating from v2](#migrating-from-v2)
  - [Migrating from v1](#migrating-from-v1)
- [Examples](#examples)
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
import App from './App.svelte';

const svelteEntrypoint = document.createElement('div');
svelteEntrypoint.id = 'svelte-entrypoint';
document.body.prepend(svelteEntrypoint);

// Create Svelte App
new App({
	target: svelteEntrypoint
});
```

_Note: Svelte needs to share the DOM with your existing app. It's recommended you don't use `document.body` as the App target while you are migrating._

`App.svelte`

```sveltehtml
<script>
    import { InjectedComponents } from "svelte-injector";
</script>

<InjectedComponents/>
```

Use `svelte-loader` or `rollup-plugin-svelte` in your bundler. Make sure you are not excluding `/svelte-injector/` as it lives in your `/node-modules/`

## Injecting Components

### Creating

#### Imported components

Import the component class into your framework controller, then use `create()`.

```typescript
import Hello from './Hello.svelte';
import { create } from 'svelte-injector';

create(target, Hello, props);
```

#### Registered components

Register component class to use it anywhere.

Import your components somewhere in your bundle (es: create an `index.module` file)

```typescript
import Hello from './Hello.svelte';
import { registerComponent } from 'svelte-injector';

registerComponent('hello', Hello);

// OR for lazy loading dynamic imports
registerComponent('hello', async () => {
	return (await import('./Hello.svelte')).default; //The given function will only be called when *hydrate* finds a component with the name "hello"
});
```

then use this string as the second argument of `create()`

```typescript
import { create } from 'svelte-injector';

create(target, 'hello', props);
```

### Hydrating

Place HTML placeholders and then `hydrate` them

Use this notation in the template:

```html
<div data-component-name="hello">
  <template class="props"">
    <!--JSON formatted-->
    {"name": "hello"}
  </template>
</div>
```

Then call `hydrate()` to update the components tree in Svelte.

```typescript
import { hydrate } from 'svelte-injector';

hydrate(target);
```

You can use `data-to-render` attribute as an `{if}` block in Svelte

```html
<div data-component-name="hello" data-to-render"true">
  <template class="props"">
    <!--JSON formatted-->
    {"name": "hello"}
  </template>
</div>
```

#### Hydrating source HTML

On multi page applications you can create components directly from the source HTML.

If any page of your source contains component markup, just `hydrate` the body to render them.

```typescript
import { hydrate } from 'svelte-injector';

hydrate(document.body);
```

_NOTE: make sure to hydrate the body only after registering your components._

# Framework integration

This project was created to easily migrate apps from AngularJs to Svelte, but it is not framework specific.

Svelte components should NOT be aware of the fact that they were used by another framework.

## React

Use the **_built-in React component_**.

```jsx
import { SvelteComponent } from 'svelte-injector/react';

// Using the class
import Component from 'src/Component.svelte';
function YourComponent(props) {
	return <SvelteComponent component={Component} props={{ name: 'world' }} />;
}

// Using the registered name
function YourComponent(props) {
	return <SvelteComponent component={'hello'} props={{ name: 'world' }} />;
}

// Conditional rendering
function YourComponent(props) {
	return <SvelteComponent component={'hello'} props={{ name: 'world' }} to-render={props.render} />;
}
```

#### Props:

```typescript
export type SvelteComponentProps = {
	component: string | typeof SvelteComponentClass;
	props?: any;
	toRender?: boolean;
	options?: CreateOptions;
	onMount?: (element: SvelteElement) => void;
};
```

## AngularJs

Use the **_built-in AngularJS component_**.

Register your Svelte component

```typescript
//  /svelte/index.module.ts

import { registerComponent } from 'svelte-injector';
import Component from 'src/Component.svelte';

registerComponent('component-name', Component);
```

```typescript
// /angularjs/index.module.ts

import { svelteComponent } from 'svelte-injector/angularjs';

angular.component('svelteComponent', svelteComponent);
```

Now in any AngularJS component you can use:

```html
<svelte-component component="component-name" props="$ctrl.svelteProps" />
```

#### Bindings:

```typescript
const bindings = {
	component: '@', // Registered component name
	props: '?<', // Props object
	toRender: '?<', // Ng-if
	options: '?<', // HydrateOptions
	encode: '?<', // encode props?
	onMount: '?&' // Function called with "element" param on mount
};
```

## Angular

Docs in progress

# JS API

## Elements

Interface `SvelteElement`

### **_updateProps(props)_**

#### props `object`

The new props object. All previous props will be dropped.

### **_setToRender(toRender)_**

#### toRender `boolean`

Set if the component should render of not. Useful for conditional rendering.

### destroy()

Destroys the component.

## Functions

### **_create(target, Component, props[,toRender], [options])_**

#### target `HTMLElement`

The element in which the component will be rendered

#### Component `SvelteComponent | string`

The Svelte component Class or the registered component name

#### props `object`

An object with props compatible with the Svelte Component

#### toRender `boolean` (default = true)

Boolean that indicates if the component should render immediately.

#### options `CreateOptions` (defaults)

Object with options

#### RETURN `Promise<SvelteElement>`

A promise that resolves the `SvelteElement` when the component is mounted or created (when toRender = false)

### **_registerComponent(name, svelteComponent)_**

#### name `string`

The name of the link

#### svelteComponent `SvelteComponent | function`

The Svelte Component class or an async functions that returns one (useful for dynamic imports and lazy loading).

### **_hydrate(target[,options])_**

#### target `HTMLElement`

The element in which the components will be looked for.

#### options `HydrateOptions` (defaults)

Object with options

#### RETURN `Promise<SvelteElement[]>`

A promise array for each created component that resolves the `SvelteElement` when the component is mounted or created (when data-to-render = false)

### **_findComponentByName(name)_**

#### name `string`

name of the component as previously registered with `registerComponent()`

#### RETURN `typeof SvelteComponent`

The Class of the registered component, if any

### **_findRegisteredComponentNameByClass(Class)_**

#### Class `typeof SvelteComponent`

Class of the component as previously registered with `registerComponent()`

#### RETURN `string`

The name of the registered component, if any

### **_generatePropsBlock(props)_**

Returns an HTML string representing the props template HTML element, as expected from `hydrate`.

### **_serializeProps(props)_**

Returns stringified (and encoded?) string from a props object, as expected from the parser.

## Options

Options object are the optional last argument of `create` and `hydrate` methods.

### CreateOptions:

#### observeParents

Create a MutationObserver on the element parent and destroy the component if no longer in the DOM

### HydrateOptions:

#### observeParents (default: true)

Create a MutationObserver on the element parent and destroy the component if no longer in the DOM

#### observe (default: true)

Create a MutationObserver on the props element and update the component on props updates.

# Migrating from earlier versions

## Migrating from v2

### Imports:

All functions from SvelteInjector are now named exports.

```typescript
import { create } from 'svelte-injector';
create(target, Component, props);

// or
import * as SvelteInjector from 'svelte-injector';
SvelteInjector.create(target, Component, props);
```

### Link -> RegisterComponent

The `link` function has been renamed to `registerComponent`.

## Migrating from v1

### Methods:

The main methods have been renamed

_createElement_ --> **_create_**

_createElementFromTemplate_, _syncTemplate_ --> **_hydrate_**

### Template

Use of `data-props` attribute is no longer supported. Props should be expressed in the new template format:

```html
<div data-component-name="hello" data-to-render"true">
  <template class="props"">
    <!--JSON formatted-->
    {"name": "hello"}
  </template>
</div>
```

# Examples

- [React](https://codesandbox.io/p/sandbox/svelteinjector-react-example-8nufl1)
- [AngularJs](https://codesandbox.io/p/sandbox/svelteinjector-angularjs-example-5ds3mf)

# Credits

- [Svelte](https://svelte.dev/)
- Portals implementation was inspired by @romkor's work on [svelte-portal](https://github.com/romkor/svelte-portal).

# License

[MIT](LICENSE)
