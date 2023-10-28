# 3.0.0

- **Performance**: Components are now directly added via the Svelte JS API without Portals.
  - This avoids duplicated DOM elements and improves performance, while still retaining the ability to inject components in any part of the DOM.
- **Types**: Better types for the JS API.
- Completely restructured the library, now using SvelteKit.

# 2.1.1

- Fix: resolved an issue that could break the InjectedComponents comp in case of dom cloning.

# 2.1.1

- Fix: only apply display contents on data-component-name elements

# 2.1.0

- Improvement: Every call to _hydrate_ updates the App only once

# 2.0.13

- Enhancement: Don't wait on each component to be rendered in _hydrate_

# 2.0.12

- [AngularJS] Prefer indexed access over _get()_ call on _$element_

# 2.0.11

- Make function _hydrate()_ catch and warn in case of errors (calling _hydrate()_ more than once on some DOM element)

# 2.0.10

- Fix: Possible race condition on element creation.

# 2.0.8

- Fix: Now correctly reading props containing HTML strings

# 2.0.7

- Fix: Dependency injection in AngularJs component when minified

# 2.0.2

- Fixed lookup for props block if not available

# 2.0.1

- Updated Docs

# 2.0.0

- **Feature**: Simplified rendering methods: create() and hydrate() (**BREAKING CHANGE**)
- **Feature**: Built-in **React** and **AngularJS** components.
- **Feature**: Use of Mutation Observers for props reactivity
- **Feature**: Support for **dynamic imports** and **lazy loading**.

# 1.2.0

- **Feature**: new, simpler and performing way of setting component props with **template** tags
- **Feature**: lazy loaded Svelte elements
- Moved to decodeURIComponent instead of decodeURI (**BREAKING CHANGE**)
