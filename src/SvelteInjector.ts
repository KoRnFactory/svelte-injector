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
	slots: Slot[];
	onMount(): void;
	destroy(): void;
	updateProps(props: any): void;
	setToRender(toRender: boolean): void;
	updateSlot(slotName: string | undefined, slotContent: string): void;
}

export interface CreateOptions {
	observeParents?: boolean;
}

export interface HydrateOptions {
	observe?: boolean;
	observeParents?: boolean;
}

interface Slot {
	name: string | undefined;
	value: string;
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
		if (typeof component === "string") {
			const Component = await this.findComponentByName(component);
			if (!Component) return Promise.reject();
			return this.createElement(domElement, Component, props, toRender, [], this.sanitizeOptions(options));
		} else {
			return this.createElement(domElement, component, props, toRender, [], this.sanitizeOptions(options, { observe: false }));
		}
	}

	private static createElement(
		domElement: HTMLElement,
		Component: typeof SvelteComponent,
		props: any,
		toRender: boolean,
		slots: Slot[],
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
				slots,
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
				async updateSlot(slotName, slotContent) {
					await SvelteInjector.setSlot(compData, slotName, slotContent);
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

	private static async setSlot(component: SvelteElement, slotName: string | undefined, slotContent: string) {
		let slotObject = component.slots.find((slot) => slot.name === slotName);
		if (!slotObject) {
			slotObject = { name: slotName, value: "" };
			component.slots.push(slotObject);
		}
		slotObject.value = slotContent;
		await this.updateComponent(component);
	}

	private static createObservers(svelteElement: SvelteElement): MutationObserver[] {
		const observers = [];
		if (svelteElement.options.observeParents) {
			observers.push(this.createRemoveObserver(svelteElement));
		}
		if (svelteElement.options.observe) {
			observers.push(this.createDataObserver(svelteElement));
		}

		const slotObservers = svelteElement.slots.map((slot) => this.createSlotObserver(svelteElement, slot.name));

		return [...observers, ...slotObservers];
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
			if (this.haveAttributesChanged(mutations)) {
				svelteElement.setToRender(this.extractToRender(svelteElement.domElement));
			}
			if (this.haveCharactersChanged(mutations)) {
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

	private static createSlotObserver(svelteElement: SvelteElement, slotName: string | undefined): MutationObserver {
		const observer = new MutationObserver((mutations) => {
			if (this.haveCharactersChanged(mutations)) {
				const { name, value } = this.extractSlot(svelteElement.domElement, slotName);
				svelteElement.updateSlot(name, value);
			}
		});

		observer.observe(svelteElement.domElement, { attributeFilter: ["data-to-render"] });

		const slotElement = this.getSlotElement(svelteElement.domElement, slotName);
		if (slotElement?.content) {
			observer.observe(slotElement.content, { characterData: true, subtree: true, childList: true });
		}

		return observer;
	}

	private static haveAttributesChanged(mutations: MutationRecord[]): boolean {
		return !!mutations.find((m) => m.type === "attributes");
	}

	private static haveCharactersChanged(mutations: MutationRecord[]): boolean {
		return !!mutations.find((m) => {
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

	private static async createElementFromTemplate(target: HTMLElement, options: CreateOptions): Promise<SvelteElement | null> {
		if (target.hasAttribute(svelteIndexAttribute)) return null;
		const componentName = target.dataset.componentName;
		if (!componentName) return Promise.reject();
		const component = await this.findComponentByName(componentName);
		if (!component) {
			console.error("Requested component not found. Did you link it first?", target, componentName);
			return Promise.reject();
		}
		const props = this.extractProps(target);
		const toRender = this.extractToRender(target);
		const slots = this.extractSlots(target);
		target.style.display = "contents";

		return this.createElement(target as HTMLElement, component, props, toRender, slots, this.sanitizeOptions(options));
	}

	private static async findElementByIndex(index: string | number): Promise<SvelteElement | null> {
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

	private static getSlotElement(svelteElement: HTMLElement, slotName: string | undefined): HTMLTemplateElement {
		const slotElements = Array.from(svelteElement.querySelectorAll(`template[data-slot]`)) as HTMLTemplateElement[];
		return slotElements.find((slotElement) => slotElement.dataset.slot === slotName) as HTMLTemplateElement;
	}

	private static getSlotElements(svelteElement: HTMLElement): HTMLTemplateElement[] {
		return Array.from(svelteElement.querySelectorAll(`template[data-slot]`)) as HTMLTemplateElement[];
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

	private static extractProps(svelteElement: HTMLElement) {
		const props = this.getPropsElement(svelteElement)?.innerHTML;
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

	private static extractSlots(svelteElement: HTMLElement): Slot[] {
		const slots = this.getSlotElements(svelteElement);
		return slots.map((slot) => {
			return { name: slot.dataset.slot, value: slot.innerHTML };
		});
	}

	private static extractSlot(svelteElement: HTMLElement, slotName: string | undefined): Slot {
		const slots = this.extractSlots(svelteElement);
		return slots.find((slot) => slot.name === slotName) ?? { name: slotName, value: "" };
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
