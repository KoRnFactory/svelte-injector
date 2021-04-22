import { SvelteElement, SvelteInjector } from "../../SvelteInjector";
declare const React: { Component: any; createRef(): any };

export interface SvelteComponentProps {
	componentName: any;
	props?: any;
	toRender?: boolean;
	options?: any;
	encode?: boolean;
	onMount?: (element: SvelteElement) => void;
}

export class SvelteComponent extends React.Component {
	private readonly propsElement: HTMLTemplateElement;
	private rootElementRef;
	constructor(props: SvelteComponentProps) {
		super(props);

		this.props.encode = this.props.encode ?? true;
		this.props.toRender = this.props.toRender ?? true;
		this.rootElementRef = React.createRef();

		const propsElement = document.createElement("template");
		propsElement.className = "props";
		this.propsElement = propsElement;
	}

	componentDidMount() {
		this.rootElementRef.current.firstChild.appendChild(this.propsElement);
		SvelteInjector.hydrate(this.rootElementRef.current, this.props.options).then(([element]) => {
			this.updateProps();
			if (this.props.onMount) this.props.onMount(element);
		});
	}

	componentDidUpdate() {
		this.updateProps()
	}

	updateProps(){
		if (this.props) {
			if (this.propsElement.content) {
				this.propsElement.content.textContent = SvelteInjector.serializeProps(this.props.props, this.props.encode);
			}
		}
	}

	render() {
		return <div ref={this.rootElementRef} data-component-name={this.props.componentName} data-to-render={this.props.toRender} />;
	}
}
