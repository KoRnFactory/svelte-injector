import type { SvelteComponent as SvelteComponentT, ComponentProps, ComponentType } from 'svelte';
import type { CreateOptions, SvelteElement } from '$lib/SvelteInjector.js';

export { SvelteComponent } from './component/svelte-component.jsx';

export type SvelteComponentProps<T extends SvelteComponentT = any> =
	| {
			/** component link name*/
			component: string;
			/** props object*/
			props?: any;
	  }
	| ({
			/** component class*/
			component: ComponentType<T>;
			/** props object*/
			props?: ComponentProps<T>;
	  } & {
			/** toRender (default: true) */
			toRender?: boolean;
			/** options (default: CreateOptions) */
			options?: CreateOptions;
			/** function called with on mount with parameters: *element* */
			onMount?: (element: SvelteElement) => void;
	  });
