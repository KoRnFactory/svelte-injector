import { SvelteInjector } from "../../SvelteInjector";

class SvelteComponentController {
	componentName: any;
	private props: any;
	toRender: any;
	options: any;
	$element : any;
	$timeout: any;
	encode: any;
	private propsElement: HTMLTemplateElement;

	constructor($element: any, $timeout: any) {
		"ngInject";
		this.$element = $element;
		this.$timeout = $timeout;

		const propsElement = document.createElement("template");
		propsElement.className = "props";
		this.propsElement = propsElement;
	}

	$onInit() {
		this.$element.get(0).firstChild.appendChild(this.propsElement);
		this.$timeout(() => {
			SvelteInjector.hydrate(this.$element.get(0), this.options);
		})
	}

	$onChanges(changes: any) {
		if(changes.encode.isFirstChange()){
			this.encode = changes.encode.currentValue ?? true;
		}
		if(changes.props.currentValue){
			this.propsElement.innerHTML = SvelteInjector.serializeProps(this.props, this.encode);
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
	},
};
