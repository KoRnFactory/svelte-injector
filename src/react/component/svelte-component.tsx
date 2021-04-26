import SvelteInjector, { CreateOptions, SvelteElement } from "../../index";
import { SvelteComponent as SvelteComponentClass } from "svelte";
import { Component, createRef, RefObject } from "react";

export type SvelteComponentProps = typeof SvelteComponent.defaultProps & {
	component: string | typeof SvelteComponentClass;
	props?: any;
	toRender?: boolean;
	options?: CreateOptions;
	onMount?: (element: SvelteElement) => void;
};

export class SvelteComponent extends Component<SvelteComponentProps, null> {
	private element: SvelteElement | undefined;
	rootElementRef: RefObject<HTMLElement>;
	static defaultProps = {
		toRender: true,
	};
	constructor(props: SvelteComponentProps) {
		super(props);
		this.rootElementRef = createRef();
	}

	componentDidMount() {
		if (this.rootElementRef.current) {
			SvelteInjector.create(
				this.rootElementRef.current,
				this.props.component,
				this.props.props,
				this.props.toRender,
				this.props.options,
			).then((element) => {
				this.element = element;
				if (this.props.onMount) this.props.onMount(element);
			});
		}
	}

	componentDidUpdate() {
		if (this.element) {
			this.element.updateProps(this.props.props);
			this.element.setToRender(this.props.toRender);
		}
	}

	render() {
		// @ts-ignore
		return <div style={{ display: "contents" }} ref={this.rootElementRef} />;
	}
}
