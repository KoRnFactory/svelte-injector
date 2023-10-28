import { components } from './stores.js';
import type { ComponentProps, ComponentType, SvelteComponent } from 'svelte';
import { get } from 'svelte/store';

interface SvelteLink<L extends string = string, T extends SvelteComponent = SvelteComponent> {
	name: L;
	svelteComponent?: ComponentType<T>;
	svelteComponentGetter?: () => Promise<ComponentType<T>>;
}

interface SvelteBaseElement<T extends SvelteComponent = SvelteComponent> {
	domElement: HTMLElement;
	Component: ComponentType<T>;
	props: ComponentProps<T>;
	toRender: boolean;
	index: number;
}

export interface SvelteElement<T extends SvelteComponent = SvelteComponent>
	extends SvelteBaseElement<T> {
	instance?: T;
	options: Options;
	observers?: MutationObserver[];
	onMount(): void;
	destroy(): void;
	updateProps(props: ComponentProps<T>): void;
	setToRender(toRender: boolean): void;
}

export interface CreateOptions {
	observeParents?: boolean;
}

export interface HydrateOptions {
	observe?: boolean;
	observeParents?: boolean;
}

interface Options {
	observe: boolean;
	observeParents: boolean;
}

const svelteIndexAttribute = 'svelte-element-index';

let links: Record<string, SvelteLink> = {};
let lastIndex = -1;
const defaultOptions: Options = {
	observe: true,
	observeParents: true
};

/**
 * @description Link a component class or a function to a string name.
 * Useful to create components from the DOM template with {@link hydrate}.
 *
 * @param name - name to assign to the component or function {@link registerComponent}
 * @param svelteComponent - Svelte component class
 */

export function registerComponent<L extends string, T extends SvelteComponent>(
	name: L,
	svelteComponent: ComponentType<T> | (() => Promise<ComponentType<T>>)
): void {
	if (isComponentClass<T>(svelteComponent)) {
		links[name] = { name, svelteComponent: svelteComponent };
	} else {
		links[name] = {
			name,
			svelteComponentGetter: svelteComponent
		};
	}
}

function isComponentClass<T extends SvelteComponent>(func: any): func is ComponentType<T> {
	return typeof func === 'function' && /^class\s/.test(Function.prototype.toString.call(func));
}

/**
 * Creates a single element at the bottom of an HTML element by component class or link name.
 *
 * @example
 * import Component from "src/Component.svelte"
 *
 * this.svelteChild = await SvelteInjector.create(this.$element[0], Component, props, options);
 *
 * @param domElement - The element in which the component will be rendered
 * @param component - the svelte component Class or the link name (as previously registered with {@link registerComponent})
 * @param props - An object with props compatible with the Svelte Component
 * @param toRender = true - Boolean that indicates if the component should render immediately
 * @param options - Object with options, optional
 * @return - A promise that resolves the {@link SvelteElement} when the component is mounted or created (when toRender = false)
 */
export async function create<T extends SvelteComponent, L extends string = string>(
	domElement: HTMLElement,
	component: ComponentType<T> | L,
	props: ComponentProps<T>,
	toRender = true,
	options = {} as CreateOptions
): Promise<SvelteElement<T>> {
	const baseElement = await createBaseElement<T, L>(domElement, component, props, toRender);
	const svelteElement = await enhanceBaseElement<T>(baseElement, sanitizeOptions(options));
	if (!svelteElement) return Promise.reject();

	const returnPromise = resolveOnMount(svelteElement);

	addComponents([svelteElement]);

	return returnPromise;
}

async function createBaseElement<T extends SvelteComponent, L extends string = string>(
	domElement: HTMLElement,
	Component: ComponentType<T> | L,
	props: ComponentProps<T>,
	toRender: boolean
): Promise<SvelteBaseElement<T>> {
	let componentClass;

	if (typeof Component === 'string') {
		const foundComponent = await findComponentByName<T, L>(Component);
		if (!foundComponent) return Promise.reject();
		componentClass = foundComponent;
	} else {
		componentClass = Component;
	}

	const index = extractIndexOrCreateNew(domElement);

	return {
		domElement,
		Component: componentClass as ComponentType<T>,
		props,
		toRender,
		index
	};
}

async function setProps<T extends SvelteComponent>(
	component: SvelteElement<T>,
	props: ComponentProps<T>
) {
	component.props = props;
	await updateComponent(component);
}

async function setToRender(component: SvelteElement, toRender: boolean) {
	if (component.toRender !== toRender) {
		component.toRender = toRender;
		await updateComponent(component);
	}
}

function createObservers(svelteElement: SvelteElement): MutationObserver[] {
	const observers = [];
	if (svelteElement.options.observeParents) {
		observers.push(createRemoveObserver(svelteElement));
	}
	if (svelteElement.options.observe) {
		observers.push(createDataObserver(svelteElement));
	}
	return observers;
}

function createRemoveObserver(svelteElement: SvelteElement): MutationObserver {
	const observer = new MutationObserver(() => {
		if (!document.body.contains(svelteElement.domElement)) {
			svelteElement.destroy();
		}
	});

	if (svelteElement.domElement.parentNode) {
		observer.observe(svelteElement.domElement.parentNode, { childList: true });
	}

	return observer;
}

function createDataObserver(svelteElement: SvelteElement): MutationObserver {
	const observer = new MutationObserver((mutations) => {
		const haveAttributesChanged = mutations.find((m) => m.type === 'attributes');
		const haveCharactersChanged = mutations.find((m) => {
			if (m.type === 'characterData') return true;
			if (m.type === 'childList') {
				if (m.removedNodes.length !== m.addedNodes.length) return true;
				let hasChanged = false;
				for (let index = 0; index < m.removedNodes.length; index++) {
					if (m.removedNodes[index].textContent !== m.addedNodes[index].textContent) {
						hasChanged = true;
						break;
					}
				}
				return hasChanged;
			}
			return false;
		});
		if (haveAttributesChanged) {
			svelteElement.setToRender(extractToRender(svelteElement.domElement));
		}
		if (haveCharactersChanged) {
			svelteElement.updateProps(extractProps(svelteElement.domElement));
		}
	});

	observer.observe(svelteElement.domElement, { attributeFilter: ['data-to-render'] });

	const propsElement = getPropsElement(svelteElement.domElement);
	if (propsElement?.content) {
		observer.observe(propsElement.content, { characterData: true, subtree: true, childList: true });
	}

	return observer;
}

/**
 * Hydrates every SvelteElements found querying the target.
 *
 * @example
 *    this.svelteChildren = await SvelteInjector.hydrate(document.body);
 * @example Component format
 * <div data-component-name="hello">
 *     <template class="props"">
 *         // JSON formatted
 *         {"name": "hello"}
 *     </template>
 * </div>
 * @example Utility
 *  <div data-component-name="hello">
 *     {writeProps(
 *     		{name: "hello"}
 *     )}
 * </div>
 * @example Conditional rendering
 * // You can use {data-to-render} as the condition in an {#if}
 * <div data-component-name="hello" data-to-render"true">
 *     <template class="props"">
 *         // JSON formatted
 *         {"name": "hello"}
 *     </template>
 * </div>
 *
 * @param domTarget - The DOM Element that will be queried for Svelte Components to create
 * @param options - Object with options, optional
 *
 * @return - An array of promises that resolve each {@link SvelteElement} when the component is mounted or created (when toRender = false)
 */
export async function hydrate(
	domTarget: HTMLElement,
	options = {} as HydrateOptions
): Promise<SvelteElement[]> {
	const svelteElements = Array.from(
		domTarget.querySelectorAll<HTMLElement>('[data-component-name]')
	);

	if (!svelteElements || !svelteElements.length) return [];

	const parsedElements = await Promise.allSettled(
		svelteElements.map((element) => parseElement(element))
	);
	const successfulElements = [];

	for (const parsedElement of parsedElements) {
		if (parsedElement.status === 'fulfilled') {
			successfulElements.push(parsedElement.value);
		}
	}

	const createdElements = (
		await Promise.all(
			successfulElements.map((element) => {
				if (!element) return null;
				return enhanceBaseElement(element, sanitizeOptions(options)).catch(console.warn);
			})
		)
	).filter((element) => element as SvelteElement) as SvelteElement[];
	const promises = createdElements.map((element) => resolveOnMount(element));

	addComponents(createdElements);

	return await Promise.all(promises);
}

export async function parseElement(domElement: HTMLElement): Promise<SvelteBaseElement> {
	const componentName = domElement.dataset.componentName;
	if (!componentName) return Promise.reject();
	const Component = await findComponentByName(componentName);
	if (!Component) {
		console.error(
			'Requested component not found. Did you link it first?',
			domElement,
			componentName
		);
		return Promise.reject();
	}
	const props = extractProps(domElement);
	const toRender = extractToRender(domElement);

	if (!Component || !domElement) {
		return Promise.reject('Component or target DOM Element not found.');
	}

	const index = extractIndexOrCreateNew(domElement);

	return {
		domElement,
		Component,
		props,
		index,
		toRender
	};
}

async function enhanceBaseElement<T extends SvelteComponent>(
	element: SvelteBaseElement<T>,
	options: Options
): Promise<SvelteElement<T> | null> {
	const alreadyCreated = findElementByIndex(element.index);
	if (alreadyCreated) {
		return Promise.reject(`Element with index: ${element.index} already created.`);
	}

	if (element.domElement.dataset.componentName) {
		element.domElement.style.display = 'contents';
	}

	const createdElement = element as SvelteElement<T>;

	createdElement.options = options;

	createdElement.onMount = () => {
		createdElement.observers = createObservers(createdElement);
	};
	createdElement.destroy = () => {
		return destroyElement(createdElement);
	};
	createdElement.updateProps = (props) => {
		return setProps(createdElement, props);
	};
	createdElement.setToRender = (toRender: boolean) => {
		return setToRender(createdElement, toRender);
	};

	return createdElement;
}

function findElementByIndex(
	index: string | number,
	currentComponents = get(components)
): SvelteElement | null {
	const element = currentComponents.find(
		(component) => component.index.toString() === index.toString()
	);
	return element ?? null;
}

function extractIndexOrCreateNew(domElement: HTMLElement) {
	const targetIndex = domElement.getAttribute(svelteIndexAttribute);
	let index: number;
	if (targetIndex) {
		index = Number.parseInt(targetIndex);
	} else {
		index = ++lastIndex;
		domElement.setAttribute(svelteIndexAttribute, index.toString());
	}
	return index;
}

function resolveOnMount<T extends SvelteComponent>(
	element: SvelteElement<T>
): Promise<SvelteElement<T>> {
	return new Promise((resolve) => {
		if (!element.toRender) {
			return resolve(element);
		}

		const previousOnMount = element.onMount;
		element.onMount = () => {
			previousOnMount();
			resolve(element);
		};
	});
}

/**
 * Finds a component class from the registered name.
 *
 * Component must have been previously registered with {@link registerComponent}
 *
 * @param name - name of the component as previously registered with {@link registerComponent}
 */
export async function findComponentByName<T extends SvelteComponent, L extends string = string>(
	name: L
): Promise<ComponentType<T> | undefined> {
	const link = links[name] as SvelteLink<L, T>;
	let component = link?.svelteComponent;
	if (!component && link?.svelteComponentGetter) {
		component = await link.svelteComponentGetter();
		link.svelteComponent = component;
	}
	return component as ComponentType<T>;
}

/**
 * Finds a component name from the registered Class.
 *
 * Component must have been previously registered with {@link registerComponent} and instantiated at least once.
 *
 * @param Class - component Class as previously registered with {@link registerComponent}
 */
export function findRegisteredComponentNameByClass<T extends SvelteComponent, L extends string>(
	Class: ComponentType<T>
): L | undefined {
	return Array.from(Object.keys(links)).find((name) => links[name].svelteComponent === Class) as
		| L
		| undefined;
}

function destroyElement(component: SvelteElement) {
	return new Promise((resolve) => {
		if (component.observers) {
			// Disconnect observers
			for (const observer of component.observers) {
				observer.disconnect();
			}
		}
		components.update((components) => {
			const index = components.indexOf(component);
			components.splice(index, 1);
			return components;
		});
		resolve(undefined);
	});
}

/**
 * Destroys all components in the array
 * @param components - An array of Svelte components to be destroyed
 *
 * @example
 * SvelteInjector.destroyAll(this.svelteChildren);
 */
export async function destroyAll(components: SvelteElement[]) {
	const promises: any[] = [];
	for (const component of components) {
		promises.push(component.destroy());
	}
	await Promise.all(promises);
}

async function clean(): Promise<number> {
	return new Promise((resolve) => {
		const unsubscribe = components.subscribe(async (components) => {
			const orphans = components.filter(
				(component) => !document.body.contains(component.domElement)
			);
			await destroyAll(orphans);
			resolve(components.length);
		});
		unsubscribe();
	});
}

function addComponents(elements: SvelteElement[]) {
	components.update((components) => {
		for (const element of elements) {
			const alreadyAdded = findElementByIndex(element.index, components);
			if (!alreadyAdded) {
				components.push(element);
			}
		}
		return components;
	});
}

function updateComponent(element: SvelteElement): Promise<null> {
	return updateComponents([element]);
}

function updateComponents(elements: SvelteElement[]): Promise<null> {
	return new Promise((resolve) => {
		components.update((components) => {
			for (const element of elements) {
				const index = components.indexOf(element);
				components[index] = element;
			}
			resolve(null);
			return components;
		});
	});
}

async function getComponentsNumber(): Promise<number> {
	const currentComponents = get(components);
	if (currentComponents.length > 0) {
		return await clean();
	}

	return 0;
}

/**
 * Stringifies and encodes a value for safe DOM usage
 *
 * See: {@link decode}
 *
 * @param value
 */
export function encodeProps(value: Record<string, any>): string {
	return encodeURIComponent(stringify(value));
}

/**
 * Decodes and parses a string encoded with {@link encode}
 *
 * @param value
 */
export function decodeProps<T extends SvelteComponent = SvelteComponent>(
	value: string
): ComponentProps<T> {
	return parseProps<T>(decodeURIComponent(value));
}

/**
 * Stringifies a value for DOM usage, without encoding
 *
 * See {@link parse}
 *
 * @param value
 * @param replacer
 * @param space
 */
export function stringify(value: any, replacer = null, space = 2): string {
	return JSON.stringify(value, replacer, space);
}

/**
 * Parses a stringified, not encoded value.
 *
 * See {@link stringify}
 *
 * @param value
 */
export function parseProps<T extends SvelteComponent = SvelteComponent>(
	value: string
): ComponentProps<T> {
	return JSON.parse(value);
}

function getPropsElement(svelteElement: HTMLElement): HTMLTemplateElement {
	return svelteElement.querySelector('template.props') as HTMLTemplateElement;
}

function sanitizeOptions(
	options: CreateOptions | HydrateOptions,
	localDefaults = {} as CreateOptions | HydrateOptions
): Options {
	return { ...defaultOptions, ...localDefaults, ...options };
}

/**
 * Returns an HTML string representing the props template HTML element, as expected from {@link hydrate}.
 *
 * @param props - props object
 * @param encode = true - apply encoding?
 */
export function generatePropsBlock<T extends SvelteComponent = SvelteComponent>(
	props: ComponentProps<T>,
	encode = true
): string {
	return `<template class="props">${serializeProps(props, encode)}</template>`;
}

/**
 * Returns stringified (and encoded?) string from an object, as expected from the parser.
 *
 * @param props - object
 * @param encode = true- apply encoding?
 */
export function serializeProps<T extends SvelteComponent = SvelteComponent>(
	props: ComponentProps<T>,
	encode = true
): string {
	return encode ? encodeProps(props) : stringify(props);
}

function extractProps<T extends SvelteComponent = SvelteComponent>(
	svelteElement: HTMLElement
): ComponentProps<T> | {} {
	const props = getPropsElement(svelteElement)?.content?.textContent?.trim();
	if (!props) return {};

	let parsedProps;
	try {
		const decode = props.startsWith('%7B');
		parsedProps = decode ? decodeProps(props) : parseProps(props);
	} catch (e) {
		console.error(
			'Malformed props for component:\n',
			svelteElement,
			'found: ',
			props,
			'\nProps should be in valid JSON format. Make sure that all keys are surrounded by double quotes' +
				'\nUse SvelteInjector.stringify() or SvelteInjector.encode() for automated processing'
		);
	}

	return parsedProps;
}

function extractToRender(svelteElement: HTMLElement): boolean {
	const toRenderAttribute = svelteElement.dataset.toRender;

	if (!toRenderAttribute) return true;

	let toRender;
	try {
		toRender = JSON.parse(toRenderAttribute);
	} catch (e) {
		console.error(
			'Malformed toRender for component:\n',
			svelteElement,
			'found: ',
			toRenderAttribute,
			'\nToRender attribute should be just true or false. Make sure it is correctly rendered in the DOM'
		);
	}

	return toRender;
}
