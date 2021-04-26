import SvelteInjector, { CreateOptions, SvelteElement } from "../../index";
import { SvelteComponent as SvelteComponentClass } from "svelte";
import React, { Component, createRef, RefObject } from "react";

export type SvelteComponentProps = typeof SvelteComponent.defaultProps & {
	component: string | typeof SvelteComponentClass;
	props?: any;
	toRender?: boolean;
	options?: CreateOptions;
	onMount?: (element: SvelteElement) => void;
};

/**
 * @description
 * React Component for svelte-injector
 *
 * **Props:**
 *
 * component - component class or link name
 *
 * props - props object
 *
 * toRender (default: true)
 *
 * options (default: CreateOptions)
 *
 * onMount - function called with on mount with parameters: *element*
 *
 * @example
 * <SvelteComponent component={Component | "hello"} props={{name: "world"}}/>
 *
 */
export class SvelteComponent extends Component<SvelteComponentProps, null> {
	private element: SvelteElement | undefined;
	rootElementRef: RefObject<HTMLDivElement>;
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
		return <div style={{ display: "contents" }} ref={this.rootElementRef} />;
	}
}
