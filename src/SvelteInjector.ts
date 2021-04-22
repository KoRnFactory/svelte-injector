import { components } from "./stores";
import { SvelteComponent } from "svelte";

interface SvelteLink {
	name: string;
	svelteComponent?: typeof SvelteComponent;
	svelteComponentGetter?: () => Promise<typeof SvelteComponent>;
}

export interface SvelteElement {
	domElement: HTMLElement;
	instance?: SvelteComponent;
	Component: typeof SvelteComponent;
	props: any;
	toRender: boolean;
	index: number;
	options: Options;
	observers?: MutationObserver[];
	onMount(): void;
	destroy(): void;
	updateProps(props: any): void;
	setToRender(toRender: boolean): void;
}

export interface CreateOptions {
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
	static links: SvelteLink[] = [];
	static lastIndex = -1;
	private static defaultOptions: Options = {
		observe: true,
		observeParents: true,
	};

	/**
	 * Links a component class or a function to a string name.
	 *
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
	 * @deprecated Now {@link link link} supports lazy linking too.
	 *
	 * Links an function that returns a component class to a string name.
	 *
	 * Useful to create components from the DOM template with {@link createLinkedElement} or {@link syncTemplate}.
	 *
	 * @param name - name of the component as previously linked with {@link link}
	 * @param svelteComponentGetter - Function that resolves a Svelte component class
	 */
	public static linkLazy(name: string, svelteComponentGetter: () => Promise<typeof SvelteComponent>): void {
		this.links.push({ name, svelteComponentGetter });
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
		if (typeof component === "string") {
			return this.createLinkedElement(domElement, component, props, toRender, options);
		} else {
			return this._createElement(domElement, component, props, toRender, this.sanitizeOptions(options));
		}
	}

	/**
	 * @deprecated use {@link create} instead
	 * Creates a single element at the bottom of an HTML element by component class.
	 *
	 * @example
	 * import Component from "src/Component.svelte"
	 *
	 * this.svelteChild = await SvelteInjector.createElement(this.$element[0], Component, props);
	 *
	 * @param domElement - The element in which the component will be rendered
	 * @param Component - The Svelte component Class
	 * @param props - An object with props compatible with the Svelte Component
	 * @param toRender = true - Boolean that indicates if the component should render immediately
	 * @param options - Object with options, optional
	 * @return - A promise that resolves the {@link SvelteElement} when the component is mounted or created (when toRender = false)
	 */
	public static createElement(
		domElement: HTMLElement,
		Component: typeof SvelteComponent,
		props: any,
		toRender = true,
		options = {} as CreateOptions,
	): Promise<SvelteElement> {
		return this._createElement(domElement, Component, props, toRender, this.sanitizeOptions(options));
	}

	/**
	 * @deprecated use {@link create} instead
	 * Creates a single element at the bottom of an HTML element by component name.
	 *
	 * @example
	 *    this.svelteChild = await SvelteInjector.createLinkedElement(this.$element[0], 'hello', props);
	 *
	 * @param domElement - The element in which the component will be rendered
	 * @param name - The Svelte component name as linked into the index module
	 * @param props - An object with props compatible with the Svelte Component
	 * @param toRender = true - Boolean that indicates if the component should render immediately
	 * @param options - Object with options, optional
	 *
	 * @return - A promise that resolves the {@link SvelteElement} when the component is mounted or created (when toRender = false)
	 */
	public static async createLinkedElement(
		domElement: HTMLElement,
		name: string,
		props: any,
		toRender = true,
		options = {} as CreateOptions,
	): Promise<SvelteElement> {
		const Component = await this.findComponentByName(name);
		if (!Component) return Promise.reject();
		return this._createElement(domElement, Component, props, toRender, this.sanitizeOptions(options));
	}

	private static _createElement(
		domElement: HTMLElement,
		Component: typeof SvelteComponent,
		props: any,
		toRender: boolean,
		options: Options,
	): Promise<SvelteElement> {
		return new Promise((resolve, reject) => {
			if (!Component || !domElement) reject();
			// let { toRender } = this.sanitizedProps(props);

			const index = ++this.lastIndex;
			domElement.setAttribute(svelteIndexAttribute, index.toString());

			const compData: SvelteElement = {
				domElement,
				Component,
				props,
				index,
				toRender,
				options,
				onMount() {
					compData.observers = SvelteInjector.createObservers(compData);
					resolve(compData);
				},
				async destroy() {
					await SvelteInjector.destroyElement(compData);
				},
				async updateProps(newProps: any) {
					await SvelteInjector.setProps(compData, newProps);
				},
				async setToRender(toRender: boolean) {
					await SvelteInjector.setToRender(compData, toRender);
				},
			};

			if (!toRender) {
				resolve(compData);
			}

			this.addComponent(compData);
		});
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
	 * @deprecated Use {@link hydrate} instead.
	 * Note: {@link hydrate} activates observers by default, but you can disable them.
	 *
	 * Creates every SvelteElements found querying the target.
	 * Works like {@link syncTemplate}
	 *
	 * @example
	 *    this.svelteChildren = await SvelteInjector.createElementsFromTemplate(document.body);
	 * @example Component format
	 * <div data-component-name="hello">
	 *     <template class="props"">
	 *         // JSON formatted
	 *         {"name": "hello"}
	 *     </template>
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
	public static async createElementsFromTemplate(domTarget: HTMLElement, options = {} as CreateOptions): Promise<SvelteElement[]> {
		const svelteElements = domTarget.querySelectorAll<HTMLElement>("[data-component-name]");

		if (!svelteElements || !svelteElements.length) return [];

		const createdComponents = [];

		options.observe = false;
		options.observeParents = false;

		// @ts-ignore
		for (const svelteElement of svelteElements) {
			const createdElement = await this.createElementFromTemplate(svelteElement, this.sanitizeOptions(options));
			if (createdElement) {
				createdComponents.push(createdElement);
			}
		}
		return createdComponents;
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
	public static async hydrate(domTarget: HTMLElement, options = {} as CreateOptions): Promise<SvelteElement[]> {
		const svelteElements = domTarget.querySelectorAll<HTMLElement>("[data-component-name]");

		if (!svelteElements || !svelteElements.length) return [];

		const createdComponents = [];

		// @ts-ignore
		for (const svelteElement of svelteElements) {
			const createdElement = await this.createElementFromTemplate(svelteElement, this.sanitizeOptions(options));
			if (createdElement) {
				createdComponents.push(createdElement);
			}
		}
		return createdComponents;
	}

	private static async createElementFromTemplate(target: HTMLElement, options: CreateOptions): Promise<SvelteElement> {
		const componentName = target.dataset.componentName;
		if (!componentName) return Promise.reject();
		const component = await this.findComponentByName(componentName);
		if (!component) {
			console.error("Requested component not found. Did you link it first?", target, componentName);
			return Promise.reject();
		}
		const props = this.extractProps(target);
		const toRender = this.extractToRender(target);

		return this._createElement(target as HTMLElement, component, props, toRender, this.sanitizeOptions(options));
	}

	/**
	 * @deprecated
	 * Use {@link findElementByIndex} instead
	 *
	 * @param index
	 */
	public static async getElementFromSvelteIndex(index: string | number): Promise<SvelteElement | null> {
		return await this.findElementByIndex(index);
	}

	public static async findElementByIndex(index: string | number): Promise<SvelteElement | null> {
		return new Promise((resolve) => {
			const unsubscribe = components.subscribe((components) => {
				const element = components.find((component) => component.index.toString() === index.toString());
				resolve(element ?? null);
			});
			unsubscribe();
		});
	}

	/**
	 * Finds a component class from the linked name.
	 *
	 * Component must have been previously linked with {@link link} or {@link linkLazy}
	 *
	 * @param name - name of the component as previously linked with {@link link} or {@link linkLazy}
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
	 * Component must have been previously linked with {@link link}
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
				// window["svelteElements"] = components;
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

	private static addComponent(component: SvelteElement) {
		components.update((components) => {
			components.push(component);
			// window["svelteElements"] = components;
			return components;
		});
	}

	private static updateComponent(component: SvelteElement): Promise<null> {
		return new Promise((resolve) => {
			components.update((components) => {
				const index = components.indexOf(component);
				components[index] = component;
				// window["svelteElements"] = components;
				resolve(null);
				return components;
			});
		});
	}

	private static async getComponentsNumber(): Promise<number> {
		return new Promise((resolve) => {
			const unsubscribe = components.subscribe(async (components) => {
				if (components.length > 0) {
					resolve(await SvelteInjector.clean());
				}
				resolve(0);
			});
			unsubscribe();
		});
	}

	/**
	 * @deprecated
	 * Use {@link hydrate} instead
	 *
	 * Creates, updates and destroys all Svelte components found as children of domTarget
	 *
	 * @description The $onChanges function won't be triggered if your INTERNAL state has changed. Only if your component props have.
	 * If your component uses internal state management, put the above snippet at the end of every state management function.
	 *
	 * <i>WARNING: if an HTMLElement that has a svelte child is rendered conditionally, it will create a new component every time the conditional expression is evaluated to true.
	 * Use "toRender" parameter if you want to reuse the component.</i>
	 *
	 * <b>Don't forget</b> to use {@link destroyAll} to optimize memory usage
	 *
	 * @example
	 *  //Use the function in a recurring lifecycle method
	 *  this.svelteChildren = await SvelteInjector.syncTemplate(target);
	 * @example Component format
	 * <div data-component-name="hello">
	 *     <template class="props"">
	 *         // JSON formatted
	 *         {"name": "hello"}
	 *     </template>
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
	 * @param domTarget - The dom element to query for Svelte children to create/update/destroy
	 * @param options - Object with options, optional
	 *
	 * @return - An array of promises that resolve the {@link SvelteElement} when the components are mounted or created (when toRender = false)
	 */
	public static async syncTemplate(domTarget: HTMLElement, options = {} as CreateOptions): Promise<SvelteElement[]> {
		const length = await this.getComponentsNumber();

		const svelteTargets = domTarget.querySelectorAll("[data-component-name]");

		if (!svelteTargets || !svelteTargets.length) return Promise.resolve([]);

		const updatedComponents = [];

		// @ts-ignore
		for (const target of svelteTargets) {
			if (length > 0 && target.hasAttribute(svelteIndexAttribute)) {
				// The element has already been created
				const element = await this.findElementByIndex(target.getAttribute(svelteIndexAttribute));

				if (!element) continue;

				if (document.body.contains(element.domElement)) {
					// Components props should be updated
					const props = this.extractProps(target as HTMLElement);
					element.updateProps(props);
					// Components toRender should be updated
					const toRender = this.extractToRender(target as HTMLElement);
					element.setToRender(toRender);
					updatedComponents.push(element);
				} else {
					// Component has been removed from the DOM
					element.destroy();
				}
			} else {
				// Need to create new element
				const createdElement = await this.createElementFromTemplate(target as HTMLElement, this.sanitizeOptions(options));
				if (createdElement) {
					updatedComponents.push(createdElement);
				}
			}
		}
		return updatedComponents;
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

	private static sanitizeOptions(options: CreateOptions, localDefaults = {} as CreateOptions): Options {
		return { ...this.defaultOptions, ...localDefaults, ...options };
	}

	/**
	 * Returns a
	 *
	 * @param props
	 * @param encode
	 */
	public static generatePropsBlock(props: any, encode = true): string {
		return `<template class="props">${this.serializeProps(props, encode)}</template>`;
	}

	public static serializeProps(props: any, encode = true): string {
		return encode ? this.encode(props) : this.stringify(props);
	}

	private static extractProps(svelteElement: HTMLElement) {
		const propsElement = this.getPropsElement(svelteElement);
		const propsAttribute = svelteElement.dataset.props;

		const props = propsElement ? propsElement.innerHTML : propsAttribute;
		if (!props) return null;

		let parsedProps;
		try {
			const decode = !!props.includes("%");
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

	private static extractToRender(svelteElement: HTMLElement) {
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
