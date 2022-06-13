import { components } from "./stores";
import { SvelteComponent } from "svelte";
import { get } from "svelte/store";

interface SvelteLink {
	name: string;
	svelteComponent?: typeof SvelteComponent;
	svelteComponentGetter?: () => Promise<typeof SvelteComponent>;
}

interface SvelteBaseElement {
	domElement: HTMLElement;
	Component: typeof SvelteComponent;
	props: any;
	toRender: boolean;
	index: number;
}

export interface SvelteElement extends SvelteBaseElement {
	instance?: SvelteComponent;
	options: Options;
	observers?: MutationObserver[];
	onMount(): void;
	destroy(): void;
	updateProps(props: any): void;
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

const svelteIndexAttribute = "svelte-element-index";

/**
 * @description Framework to inject Svelte components into other frameworks plus some tools.
 *
 * Refer to https://github.com/KoRnFactory/svelte-injector for full documentation
 *
 * To use your component use either {@link create} or {@link hydrate}.
 *
 * Have fun!
 *
 */
export class SvelteInjector {
	private static links: SvelteLink[] = [];
	private static lastIndex = -1;
	private static defaultOptions: Options = {
		observe: true,
		observeParents: true,
	};

	/**
	 * @description Link a component class or a function to a string name.
	 * Useful to create components from the DOM template with {@link hydrate}.
	 *
	 * @param name - name to assign to the component or function {@link link}
	 * @param svelteComponent - Svelte component class
	 */
	public static link(name: string, svelteComponent: typeof SvelteComponent | (() => Promise<typeof SvelteComponent>)): void {
		if (this.isClass(svelteComponent)) {
			this.links.push({ name, svelteComponent: svelteComponent as typeof SvelteComponent });
		} else {
			this.links.push({ name, svelteComponentGetter: svelteComponent as () => Promise<typeof SvelteComponent> });
		}
	}

	private static isClass(func: any) {
		return typeof func === "function" && /^class\s/.test(Function.prototype.toString.call(func));
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
	 * @param component - the svelte component Class or the link name (as previously {@link link linked})
	 * @param props - An object with props compatible with the Svelte Component
	 * @param toRender = true - Boolean that indicates if the component should render immediately
	 * @param options - Object with options, optional
	 * @return - A promise that resolves the {@link SvelteElement} when the component is mounted or created (when toRender = false)
	 */
	public static async create(
		domElement: HTMLElement,
		component: typeof SvelteComponent | string,
		props: any,
		toRender = true,
		options = {} as CreateOptions,
	): Promise<SvelteElement> {
		const baseElement = await SvelteInjector.createBaseElement(domElement, component, props, toRender);
		const svelteElement = await SvelteInjector.enhanceBaseElement(baseElement, this.sanitizeOptions(options));
		if (!svelteElement) return Promise.reject();

		const returnPromise = SvelteInjector.resolveOnMount(svelteElement);

		SvelteInjector.addComponents([svelteElement]);

		return returnPromise;
	}

	private static async createBaseElement(
		domElement: HTMLElement,
		Component: typeof SvelteComponent | string,
		props: any,
		toRender: boolean,
	): Promise<SvelteBaseElement> {
		let componentClass: typeof SvelteComponent;

		if (typeof Component === "string") {
			const foundComponent = await this.findComponentByName(Component);
			if (!foundComponent) return Promise.reject();
			componentClass = foundComponent;
		} else {
			componentClass = Component;
		}

		const index = SvelteInjector.extractIndexOrCreateNew(domElement);

		return {
			domElement,
			Component: componentClass,
			props,
			toRender,
			index,
		};
	}

	private static async setProps(component: SvelteElement, props: any) {
		component.props = props;
		await this.updateComponent(component);
	}

	private static async setToRender(component: SvelteElement, toRender: boolean) {
		if (component.toRender !== toRender) {
			component.toRender = toRender;
			await this.updateComponent(component);
		}
	}

	private static createObservers(svelteElement: SvelteElement): MutationObserver[] {
		const observers = [];
		if (svelteElement.options.observeParents) {
			observers.push(this.createRemoveObserver(svelteElement));
		}
		if (svelteElement.options.observe) {
			observers.push(this.createDataObserver(svelteElement));
		}
		return observers;
	}

	private static createRemoveObserver(svelteElement: SvelteElement): MutationObserver {
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

	private static createDataObserver(svelteElement: SvelteElement): MutationObserver {
		const observer = new MutationObserver((mutations) => {
			const haveAttributesChanged = mutations.find((m) => m.type === "attributes");
			const haveCharactersChanged = mutations.find((m) => {
				if (m.type === "characterData") return true;
				if (m.type === "childList") {
					if (m.removedNodes.length !== m.addedNodes.length) return true;
					let hasChanged = false;
					m.removedNodes.forEach((node, index) => {
						if (node.textContent !== m.addedNodes[index].textContent) {
							hasChanged = true;
						}
					});
					return hasChanged;
				}
				return false;
			});
			if (haveAttributesChanged) {
				svelteElement.setToRender(this.extractToRender(svelteElement.domElement));
			}
			if (haveCharactersChanged) {
				svelteElement.updateProps(this.extractProps(svelteElement.domElement));
			}
		});

		observer.observe(svelteElement.domElement, { attributeFilter: ["data-to-render"] });

		const propsElement = this.getPropsElement(svelteElement.domElement);
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
	 *     {SvelteInjector.writeProps(
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
	public static async hydrate(domTarget: HTMLElement, options = {} as HydrateOptions): Promise<SvelteElement[]> {
		const svelteElements = Array.from(domTarget.querySelectorAll<HTMLElement>("[data-component-name]"));

		if (!svelteElements || !svelteElements.length) return [];

		const parsedElements = await Promise.all(svelteElements.map((element) => SvelteInjector.parseElement(element)));
		const createdElements = (
			await Promise.all(
				parsedElements.map((element) => SvelteInjector.enhanceBaseElement(element, this.sanitizeOptions(options)).catch(console.warn)),
			)
		).filter((element) => element as SvelteElement) as SvelteElement[];
		const promises = createdElements.map((element) => SvelteInjector.resolveOnMount(element));

		SvelteInjector.addComponents(createdElements);

		return await Promise.all(promises);
	}

	public static async parseElement(domElement: HTMLElement): Promise<SvelteBaseElement> {
		const componentName = domElement.dataset.componentName;
		if (!componentName) return Promise.reject();
		const Component = await this.findComponentByName(componentName);
		if (!Component) {
			console.error("Requested component not found. Did you link it first?", domElement, componentName);
			return Promise.reject();
		}
		const props = this.extractProps(domElement);
		const toRender = this.extractToRender(domElement);

		if (!Component || !domElement) {
			return Promise.reject("Component or target DOM Element not found.");
		}

		const index = this.extractIndexOrCreateNew(domElement);

		return {
			domElement,
			Component,
			props,
			index,
			toRender,
		};
	}

	private static async enhanceBaseElement(element: SvelteBaseElement, options: Options): Promise<SvelteElement | null> {
		const alreadyCreated = SvelteInjector.findElementByIndex(element.index);
		if (alreadyCreated) {
			return Promise.reject(`Element with index: ${element.index} already created.`);
		}

		if (element.domElement.dataset.componentName) {
			element.domElement.style.display = "contents";
		}

		const createdElement = element as SvelteElement;

		createdElement.options = options;

		createdElement.onMount = () => {
			createdElement.observers = SvelteInjector.createObservers(createdElement);
		};
		createdElement.destroy = () => {
			SvelteInjector.destroyElement(createdElement);
		};
		createdElement.updateProps = (props: any) => {
			SvelteInjector.setProps(createdElement, props);
		};
		createdElement.setToRender = (toRender: boolean) => {
			SvelteInjector.setToRender(createdElement, toRender);
		};

		return createdElement;
	}

	private static findElementByIndex(index: string | number): SvelteElement | null {
		const currentComponents = get(components);
		const element = currentComponents.find((component) => component.index.toString() === index.toString());
		return element ?? null;
	}

	private static extractIndexOrCreateNew(domElement: HTMLElement) {
		const targetIndex = domElement.getAttribute(svelteIndexAttribute);
		let index: number;
		if (targetIndex) {
			index = Number.parseInt(targetIndex);
		} else {
			index = ++this.lastIndex;
			domElement.setAttribute(svelteIndexAttribute, index.toString());
		}
		return index;
	}

	private static resolveOnMount(element: SvelteElement): Promise<SvelteElement> {
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
	 * Finds a component class from the linked name.
	 *
	 * Component must have been previously linked with {@link link}
	 *
	 * @param name - name of the component as previously linked with {@link link}
	 */
	public static async findComponentByName(name: string): Promise<typeof SvelteComponent | undefined> {
		const link = this.links.find((link) => link.name.toLowerCase() === name.toLowerCase());
		let component = link?.svelteComponent;
		if (!component && link?.svelteComponentGetter) {
			component = await link.svelteComponentGetter();
			link.svelteComponent = component;
		}
		return component;
	}

	/**
	 * Finds a component name from the linked Class.
	 *
	 * Component must have been previously linked with {@link link} and instantiated at least once.
	 *
	 * @param Class - component Class as previously linked with {@link link}
	 */
	public static findLinkNameByClass(Class: typeof SvelteComponent): string | undefined {
		return this.links.find((link) => link.svelteComponent === Class)?.name;
	}

	private static destroyElement(component: SvelteElement) {
		return new Promise((resolve) => {
			if (component.observers) {
				// Disconnect observers
				component.observers.forEach((obs) => obs.disconnect());
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
	public static async destroyAll(components: SvelteElement[]) {
		const promises: any[] = [];
		components.forEach((component) => promises.push(component.destroy()));
		await Promise.all(promises);
	}

	private static async clean(): Promise<number> {
		return new Promise((resolve) => {
			const unsubscribe = components.subscribe(async (components) => {
				const orphans = components.filter((component) => !document.body.contains(component.domElement));
				await this.destroyAll(orphans);
				resolve(components.length);
			});
			unsubscribe();
		});
	}

	private static addComponents(elements: SvelteElement[]) {
		components.update((components) => {
			components.push(...elements);
			return components;
		});
	}

	private static updateComponent(element: SvelteElement): Promise<null> {
		return SvelteInjector.updateComponents([element]);
	}

	private static updateComponents(elements: SvelteElement[]): Promise<null> {
		return new Promise((resolve) => {
			components.update((components) => {
				elements.forEach((element) => {
					const index = components.indexOf(element);
					components[index] = element;
				});
				resolve(null);
				return components;
			});
		});
	}

	private static async getComponentsNumber(): Promise<number> {
		const currentComponents = get(components);
		if (currentComponents.length > 0) {
			return await SvelteInjector.clean();
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
	public static encode(value: any): string {
		return encodeURIComponent(this.stringify(value));
	}

	/**
	 * Decodes and parses a string encoded with {@link encode}
	 *
	 * @param value
	 */
	public static decode(value: string): any {
		return this.parse(decodeURIComponent(value));
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
	public static stringify(value: any, replacer = null, space = 2): string {
		return JSON.stringify(value, replacer, space);
	}

	/**
	 * Parses a stringified, not encoded value.
	 *
	 * See {@link stringify}
	 *
	 * @param value
	 */
	public static parse(value: string): any {
		return JSON.parse(value);
	}

	private static getPropsElement(svelteElement: HTMLElement): HTMLTemplateElement {
		return svelteElement.querySelector("template.props") as HTMLTemplateElement;
	}

	private static sanitizeOptions(options: CreateOptions | HydrateOptions, localDefaults = {} as CreateOptions | HydrateOptions): Options {
		return { ...this.defaultOptions, ...localDefaults, ...options };
	}

	/**
	 * Returns an HTML string representing the props template HTML element, as expected from {@link hydrate}.
	 *
	 * @param props - props object
	 * @param encode = true - apply encoding?
	 */
	public static generatePropsBlock(props: any, encode = true): string {
		return `<template class="props">${this.serializeProps(props, encode)}</template>`;
	}

	/**
	 * Returns stringified (and encoded?) string from an object, as expected from the parser.
	 *
	 * @param props - object
	 * @param encode = true- apply encoding?
	 */
	public static serializeProps(props: any, encode = true): string {
		return encode ? this.encode(props) : this.stringify(props);
	}

	private static extractProps(svelteElement: HTMLElement): Record<string, any> | null {
		const props = this.getPropsElement(svelteElement)?.content?.textContent;
		if (!props) return null;

		let parsedProps;
		try {
			const decode = !!props.includes("%7B");
			parsedProps = decode ? this.decode(props) : this.parse(props);
		} catch (e) {
			console.error(
				"Malformed props for component:\n",
				svelteElement,
				"found: ",
				props,
				"\nProps should be in valid JSON format. Make sure that all keys are surrounded by double quotes" +
					"\nUse SvelteInjector.stringify() or SvelteInjector.encode() for automated processing",
			);
		}

		return parsedProps;
	}

	private static extractToRender(svelteElement: HTMLElement): boolean {
		const toRenderAttribute = svelteElement.dataset.toRender;

		if (!toRenderAttribute) return true;

		let toRender;
		try {
			toRender = JSON.parse(toRenderAttribute);
		} catch (e) {
			console.error(
				"Malformed toRender for component:\n",
				svelteElement,
				"found: ",
				toRenderAttribute,
				"\nToRender attribute should be just true or false. Make sure it is correctly rendered in the DOM",
			);
		}

		return toRender;
	}
}
