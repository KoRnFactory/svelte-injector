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
 * @description Framework to inject Svelte components into AngularJS plus some tools.
 * To use a component use either {@link createElement}, {@link createLinkedElement} or {@link syncTemplate}.
 *
 * Have fun!
 *
 */
export class AngularToSvelte {
	static links: SvelteLink[] = [];
	static lastIndex = -1;

	public static link(name: string, svelteComponent: typeof SvelteComponent) {
		this.links.push({ name, svelteComponent });
	}

	/**
	 * Creates a single element at the bottom of an HTML element by component class.
	 *
	 * For performance reasons it is recommended that you use this function in a $timeout.
	 *
	 * @example
	 * import Component from "src/Component.svelte"
	 *
	 * this.$timeout(async () => {
	 * 	this.svelteChild = await AngularToSvelte.createElement(this.$element[0], Component, {name: "world"});
	 * });
	 *
	 * @param domElement - The element in which the component will be rendered
	 * @param Component - The Svelte component Class
	 * @param props - An object with props compatible with the Svelte Component
	 * @param toRender = true - Boolean that indicates if the component should render immediately
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
	 * For performance reasons it is recommended that you use this function in a $timeout.
	 *
	 * @example
	 * this.$timeout(async () => {
	 * 	this.svelteChild = await AngularToSvelte.createLinkedElement(this.$element[0], 'hello', {name: "world"});
	 * });
	 *
	 * @param domElement - The element in which the component will be rendered
	 * @param name - The Svelte component name as linked into the index module
	 * @param props - An object with props compatible with the Svelte Component
	 * @param toRender = true - Boolean that indicates if the component should render immediately
	 */
	public static createLinkedElement(domElement: HTMLElement, name: string, props: any, toRender = true): Promise<SvelteElement> {
		if (!domElement) return null;
		let Component = this.findComponent(name);
		return this._createElement(domElement, Component, props, toRender);
	}


	private static _createElement(
		domElement: HTMLElement,
		Component: typeof SvelteComponent,
		props: any,
		toRender: boolean,
	): Promise<SvelteElement> {
		if (!Component || !domElement) return null;
		// let { toRender } = this.sanitizedProps(props);

		let index = ++this.lastIndex;
		domElement.setAttribute(svelteIndexAttribute, index.toString());

		return new Promise((resolve) => {
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
					await AngularToSvelte.destroy(compData);
				},
				async updateProps(newProps: any) {
					await AngularToSvelte.setProps(compData, newProps);
				},
				async setToRender(toRender: boolean) {
					await AngularToSvelte.setToRender(compData, toRender);
				},
			};

			if (!toRender) {
				resolve(compData);
			}

			this.addComponent(compData);
		});
	}

/*	private static sanitizedProps(props: any) {
		let toRender = props?.toRender ?? true;
		delete props?.toRender;

		return { toRender };
	}*/

	private static async setProps(component: SvelteElement, props: any) {
		component.props = props;
		await this.updateComponent(component);
	}

	private static async setToRender(component: SvelteElement, toRender: boolean) {
		if (component.toRender != toRender) {
			component.toRender = toRender;
			await this.updateComponent(component);
		}
	}

	static async createElementsFromTemplate(target: HTMLElement): Promise<SvelteElement[]> {
		const svelteElements = target.querySelectorAll("[data-component-name]");

		if (!svelteElements || !svelteElements.length) return;

		let createdComponents = [];

		for (const svelteElement of svelteElements) {
			let createdElement = await this.createElementFromTemplate(svelteElement as HTMLElement);
			if (createdElement) {
				createdComponents.push(createdElement);
			}
		}
		return createdComponents;
	}

	private static createElementFromTemplate(target: HTMLElement): Promise<SvelteElement> {
		const componentName = target.dataset.componentName;
		const component = this.findComponent(componentName);
		if (!component) return;
		const props = this.extractProps(target);
		const toRender = this.extractToRender(target);

		return this.createElement(target as HTMLElement, component, props, toRender);
	}

	public static async getElementFromSvelteIndex(index: string | number): Promise<SvelteElement> {
		return new Promise((resolve) => {
			const unsubscribe = components.subscribe((components) => {
				let element = components.find((component) => component.index.toString() === index.toString());
				resolve(element);
			});
			unsubscribe();
		});
	}

	private static findComponent(name: string): typeof SvelteComponent {
		return this.links.find((link) => link.name.toLowerCase() === name.toLowerCase())?.svelteComponent;
	}

	private static destroy(component: SvelteElement) {
		return new Promise((resolve) => {
			components.update((components) => {
				const index = components.indexOf(component);
				components.splice(index, 1);
				window["svelteElements"] = components;
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
	 * AngularToSvelte.destroyAll(this.svelteChildren);
	 */
	public static async destroyAll(components: SvelteElement[]) {
		let promises = [];
		components.forEach((component) => promises.push(component.destroy()));
		await Promise.all(promises);
	}

	private static async clean(): Promise<number> {
		return new Promise((resolve) => {
			const unsubscribe = components.subscribe(async (components) => {
				const orphans = components.filter((component) => document.body.contains(component.domElement) === false);
				await this.destroyAll(orphans);
				resolve(components.length);
			});
			unsubscribe();
		});
	}

	private static addComponent(component: SvelteElement) {
		components.update((components) => {
			components.push(component);
			window["svelteElements"] = components;
			return components;
		});
	}

	private static updateComponent(component: SvelteElement) {
		return new Promise((resolve) => {
			components.update((components) => {
				const index = components.indexOf(component);
				components[index] = component;
				window["svelteElements"] = components;
				resolve(undefined);
				return components;
			});
		});
	}

	private static async getComponentsNumber() {
		return new Promise((resolve) => {
			const unsubscribe = components.subscribe(async (components) => {
				if (components.length > 0) {
					resolve(await AngularToSvelte.clean());
				}
				resolve(0);
			});
			unsubscribe();
		});
	}


	/**
	 * Creates, updates and destroys all Svelte components found as children of domTarget
	 *
	 * For performance reasons it is recommended that you use this function in a $timeout.
	 *
	 * @description The $onChanges function won't be triggered if your INTERNAL state has changed. Only if your component props have.
	 * If your component uses internal state management, put the above snippet at the end of every state management function.
	 * Oh, and if you're asking. YES, the timeout is needed.
	 *
	 * <i>WARNING: if an angular element with an ng-if has a svelte child, it will create a new component every time the ng-if expression is evaluated to true.
	 * Use "toRender" prop if you want to reuse the component.</i>
	 *
	 * <b>Don't forget</b> to use {@link destroyAll} in your $onDestroy to optimize memory usage
	 *
	 * @example
	 * // 1 - Put this in your $onChanges:
	 * this.$timeout(async () => {
	 *   this.svelteChildren = await AngularToSvelte.syncTemplate(this.$element[0]);
	 * })
	 *
	 * //2 - Use the component in your markup like so:
	 * <div data-component-name="hello" data-props='{"name": "world"}'></div>
	 *
	 * @example ng-if
	 * // You can use {data-to-render} as an ng-if
	 * <div data-component-name="hello" data-props='{"name": "world"}' data-to-render"'true'"></div>
	 *
	 * @param domTarget - The dom element to query for Svelte children to create/update/destroy
	 */
	public static async syncTemplate(domTarget: HTMLElement): Promise<SvelteElement[]> {
		let length = await this.getComponentsNumber();

		const svelteTargets = domTarget.querySelectorAll("[data-component-name]");

		if (!svelteTargets || !svelteTargets.length) return;

		let updatedComponents = [];

		for (const target of svelteTargets) {
			if (length > 0 && target.hasAttribute(svelteIndexAttribute)) {
				// The element has already been created
				const element = await this.getElementFromSvelteIndex(target.getAttribute(svelteIndexAttribute));

				if (!element) continue;

				if (document.body.contains(element.domElement)) {
					// Components props should be updated
					let props = this.extractProps(target as HTMLElement);
					element.updateProps(props);
					// Components toRender should be updated
					let toRender = this.extractToRender(target as HTMLElement);
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
		let toRenderAttribute = svelteElement.dataset.toRender;

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
