import { components } from "./stores";
import { SvelteComponent } from "svelte";

interface SvelteLink {
	name: string;
	svelteComponent: typeof SvelteComponent;
}

export interface SvelteElement {
	domElement: HTMLElement;
	instance?: SvelteComponent;
	Component: typeof SvelteComponent;
	props: any;
	toRender: boolean;
	index: number;
	onMount(): void;
	destroy(): void;
	updateProps(props: any): void;
	setToRender(toRender: boolean): void;
}

const svelteIndexAttribute = "svelte-element-index";

/**
 * @description Framework to inject Svelte components into other frameworks plus some tools.
 *
 * Refer to https://github.com/KoRnFactory/svelte-injector for full documentation
 *
 * To use your component use either {@link createElement}, {@link createLinkedElement} or {@link syncTemplate}.
 *
 * Have fun!
 *
 */
export class SvelteInjector {
	static links: SvelteLink[] = [];
	static lastIndex = -1;

	/**
	 * Links a component class to a string name.
	 *
	 * Useful to create components from the DOM template with {@link createLinkedElement} or {@link syncTemplate}.
	 *
	 * @param name - name of the component as previously linked with {@link link}
	 * @param svelteComponent - Svelte component class
	 */
	public static link(name: string, svelteComponent: typeof SvelteComponent) {
		this.links.push({ name, svelteComponent });
	}

	/**
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
	 *
	 * @return - A promise that resolves the {@link SvelteElement} when the component is mounted or created (when toRender = false)
	 */
	public static createElement(
		domElement: HTMLElement,
		Component: typeof SvelteComponent,
		props: any,
		toRender = true,
	): Promise<SvelteElement> {
		return this._createElement(domElement, Component, props, toRender);
	}

	/**
	 * Creates a single element at the bottom of an HTML element by component name.
	 *
	 * @example
	 * 	this.svelteChild = await SvelteInjector.createLinkedElement(this.$element[0], 'hello', props);
	 *
	 * @param domElement - The element in which the component will be rendered
	 * @param name - The Svelte component name as linked into the index module
	 * @param props - An object with props compatible with the Svelte Component
	 * @param toRender = true - Boolean that indicates if the component should render immediately
	 *
	 * @return - A promise that resolves the {@link SvelteElement} when the component is mounted or created (when toRender = false)
	 */
	public static createLinkedElement(domElement: HTMLElement, name: string, props: any, toRender = true): Promise<SvelteElement> {
		const Component = this.findComponentByName(name);
		if (!Component) return Promise.reject();
		return this._createElement(domElement, Component, props, toRender);
	}

	private static _createElement(
		domElement: HTMLElement,
		Component: typeof SvelteComponent,
		props: any,
		toRender: boolean,
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
				onMount() {
					resolve(compData);
				},
				async destroy() {
					await SvelteInjector.destroy(compData);
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

	/**
	 * Creates every SvelteElements found querying the target.
	 * Works like {@link syncTemplate}
	 *
	 * @example
	 * 	this.svelteChildren = await SvelteInjector.createElementsFromTemplate(document.body);
	 * @example Component format
	 * 		<div data-component-name="hello" data-props='{"name": "world"}'></div>
	 * @example Conditional rendering
	 * 		You can use {data-to-render} as the condition in an {#if}
	 * 		<div data-component-name="hello" data-props='{"name": "world"}' data-to-render"'true'"></div>
	 *
	 * @param domTarget - The DOM Element that will be queried for Svelte Components to create
	 *
	 * @return - An array of promises that resolve each {@link SvelteElement} when the component is mounted or created (when toRender = false)
	 */
	public static async createElementsFromTemplate(domTarget: HTMLElement): Promise<SvelteElement[]> {
		const svelteElements = domTarget.querySelectorAll<HTMLElement>("[data-component-name]");

		if (!svelteElements || !svelteElements.length) return [];

		const createdComponents = [];

		// @ts-ignore
		for (const svelteElement of svelteElements) {
			const createdElement = await this.createElementFromTemplate(svelteElement);
			if (createdElement) {
				createdComponents.push(createdElement);
			}
		}
		return createdComponents;
	}

	private static createElementFromTemplate(target: HTMLElement): Promise<SvelteElement> {
		const componentName = target.dataset.componentName;
		if (!componentName) return Promise.reject();
		const component = this.findComponentByName(componentName);
		if (!component) return Promise.reject();
		const props = this.extractProps(target);
		const toRender = this.extractToRender(target);

		return this.createElement(target as HTMLElement, component, props, toRender);
	}

	public static async getElementFromSvelteIndex(index: string | number): Promise<SvelteElement | undefined> {
		return new Promise((resolve) => {
			const unsubscribe = components.subscribe((components) => {
				const element = components.find((component) => component.index.toString() === index.toString());
				resolve(element);
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
	public static findComponentByName(name: string): typeof SvelteComponent | undefined {
		return this.links.find((link) => link.name.toLowerCase() === name.toLowerCase())?.svelteComponent;
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

	private static destroy(component: SvelteElement) {
		return new Promise((resolve) => {
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

	private static updateComponent(component: SvelteElement) {
		return new Promise((resolve) => {
			components.update((components) => {
				const index = components.indexOf(component);
				components[index] = component;
				// window["svelteElements"] = components;
				resolve(undefined);
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
	 * <div data-component-name="hello" data-props='{"name": "world"}'></div>
	 * @example Conditional rendering
	 * // You can use {data-to-render} as the condition in an {#if}
	 * <div data-component-name="hello" data-props='{"name": "world"}' data-to-render"'true'"></div>
	 *
	 * @param domTarget - The dom element to query for Svelte children to create/update/destroy
	 *
	 * @return - An array of promises that resolve the {@link SvelteElement} when the components are mounted or created (when toRender = false)
	 */
	public static async syncTemplate(domTarget: HTMLElement): Promise<SvelteElement[]> {
		const length = await this.getComponentsNumber();

		const svelteTargets = domTarget.querySelectorAll("[data-component-name]");

		if (!svelteTargets || !svelteTargets.length) return Promise.resolve([]);

		const updatedComponents = [];

		// @ts-ignore
		for (const target of svelteTargets) {
			if (length > 0 && target.hasAttribute(svelteIndexAttribute)) {
				// The element has already been created
				const element = await this.getElementFromSvelteIndex(target.getAttribute(svelteIndexAttribute));

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
				const createdElement = await this.createElementFromTemplate(target as HTMLElement);
				if (createdElement) {
					updatedComponents.push(createdElement);
				}
			}
		}
		return updatedComponents;
	}

	private static extractProps(svelteElement: HTMLElement) {
		let propsAttribute = svelteElement.dataset.props;

		if (!propsAttribute) return null;

		if (propsAttribute.startsWith("%")) {
			propsAttribute = decodeURI(propsAttribute);
		}

		let parsedProps;
		try {
			parsedProps = JSON.parse(propsAttribute);
		} catch (e) {
			console.warn(
				"Malformed props for component:\n",
				svelteElement,
				"\nProps should be in valid JSON format. Make sure that all keys are surrounded by double quotes",
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
			console.warn(
				"Malformed toRender for component:\n",
				svelteElement,
				"\nToRender should be in valid JSON format. Make sure it is correctly rendered in the DOM",
			);
		}

		return toRender;
	}
}
