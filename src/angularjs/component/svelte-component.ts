import { SvelteInjector } from "../../SvelteInjector";

class SvelteComponentController {
	componentName: any;
	private props: any;
	toRender: boolean;
	options: any;
	$element : any;
	$timeout: any;
	encode: boolean;
	onMount: any;
	private propsElement: HTMLTemplateElement;

	constructor($element: any, $timeout: any) {
		"ngInject";
		this.$element = $element;
		this.$timeout = $timeout;

		this.encode = true;
		this.toRender = true;
		const propsElement = document.createElement("template");
		propsElement.className = "props";
		this.propsElement = propsElement;
	}

	$onInit() {
		this.$element.get(0).firstChild.appendChild(this.propsElement);
		this.$timeout(() => {
			SvelteInjector.hydrate(this.$element.get(0), this.options).then(([element]) => {
				if (this.onMount) this.onMount({ element });
			})
		})
	}

	$onChanges(changes: any) {
		if(changes.props?.currentValue){
			if(this.propsElement.content){
				this.propsElement.content.textContent = SvelteInjector.serializeProps(this.props, this.encode);
			}
		}
	}
}

export const svelteComponent = {
	template: `<div data-component-name="{{$ctrl.componentName}}" data-to-render="{{$ctrl.toRender}}"></div>`,
	controller: SvelteComponentController,
	bindings: {
		componentName: "@",
		props: "<",
		toRender: "<",
		options: "<",
		encode: "<",
		onMount: "&",
	},
};
