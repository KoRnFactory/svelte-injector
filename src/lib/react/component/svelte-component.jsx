import { create } from '$lib/SvelteInjector';
import React, { createRef, useEffect } from 'react';

/**
 * @description
 * React Component for svelte-injector
 *
 * @example
 * <SvelteComponent component={Component | "hello"} props={{name: "world"}}/>
 *
 * @param props {import("$lib/react").SvelteComponentProps}
 */
export function SvelteComponent(props) {
	/** @type {import("react").RefObject<HTMLDivElement>} */
	const rootElementRef = createRef();
	const { component, props: componentProps, toRender, options, onMount } = props;
	/** @type {import("$lib/SvelteInjector").SvelteElement} */
	let element;

	useEffect(() => {
		if (rootElementRef.current) {
			create(rootElementRef.current, component, componentProps, toRender, options).then((el) => {
				element = el;
				if (onMount) onMount(el);
			});
		}
	}, [rootElementRef]);

	useEffect(() => {
		if (element) {
			element.updateProps(componentProps);
			element.setToRender(toRender);
		}
	}, [componentProps, toRender]);

	return <div style={{ display: 'contents' }} ref={rootElementRef} />;
}
