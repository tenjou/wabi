import { store } from "./store";
import { update } from "./renderer";

let nextComponent = null

const component = function(componentProto)
{
	function Component(nodeName, key) {
		NodeData.call(this, nodeName, key)
	}

	const proto = Object.create(NodeData.prototype);

	for(let key in componentProto) 
	{
		const param = Object.getOwnPropertyDescriptor(componentProto, key);
		if(param.get || param.set) { 
			Object.defineProperty(proto, key, param);
		}
		else {
			proto[key] = componentProto[key];
		}
	}

	const states = proto.state
	for(let key in states) 
	{
		Object.defineProperty(proto, "$" + key,
		{
			set(value) {
				this.setState(key, value)
			},
			get() {
				return this.$[key]
			}
		})
	}

	if(proto.state.value === undefined) {
		proto.state.value = null
	}

	Component.prototype = proto;
	Component.prototype.constructor = Component;

	return Component
}

function NodeData(nodeName, key) 
{
	this.attributes = Object.create(null)
	this.parentAttributes = null

	/**
	 * Whether or not the statics have been applied for the node yet.
	 * {boolean}
	 */
	this.staticsApplied = false;

	/**
	 * The key used to identify this node, used to preserve DOM nodes when they
	 * move within their parent.
	 * @const
	 */
	this.key = key;

	/**
	 * Keeps track of children within this node by their key.
	 * {!Object<string, !Element>}
	 */
	this.keyMap = Object.create(null);

	/**
	 * Whether or not the keyMap is currently valid.
	 * @type {boolean}
	 */
	this.keyMapValid = true;

	/**
	 * Whether or the associated node is, or contains, a focused Element.
	 * @type {boolean}
	 */
	this.focused = false;

	/**
	 * The node name for this node.
	 * @const {string}
	 */
	this.nodeName = nodeName;

	const currState = {}
	for(let key in this.state) {
		currState[key] = this.state[key]
	}

	this.$ = currState;
}

NodeData.prototype = 
{
	state: {
		value: null
	},

	remove() 
	{
		if(this.attributes.bind) {
			store.unwatch(this.attributes.bind)
		}
	},

	setState(state, value)
	{
		if(this.$[state] === value) { return }

		if(state === "value" && this.attributes.bind) {
			store.set(this.attributes.bind, value)
		}
		else {
			this.$[state] = value
			update()
		}
	},

	set $value(value) {
		this.setState("value", value);
	},

	get $value() {
		return this.$.value
	},

	handleAction(payload) {
		this.$.value = payload.value
		update()
	},

	set bind(value) 
	{
		if(this.attributes.bind) {
			store.unwatch(this.attributes.bind, this)
		}

		if(value) {
			store.watch(value, this)
		}

		this.$.value = store.get(value)
	},

	get bind() {
		return this.attributes.bind
	}
}

const initData = function(node, nodeName, key)
{
	let data
	if(nextComponent) {
		data = nextComponent
		data.nodeName = nodeName
		data.key = data.key || key
		nextComponent = null
	}
	else {
		data = new NodeData(nodeName, key)
	}

	node.metaData = data
	return data
}

const getData = function(node) {
	importNode(node)
	return node.metaData
}

const importNode = function(node) 
{
	if(node.metaData) {
		return
	}

	const isElement = node instanceof Element;
	const nodeName = isElement ? node.localName : node.nodeName;
	const key = isElement ? node.getAttribute('key') : null;
	const data = initData(node, nodeName, key);

	if(key) {
		getData(node.parentNode).keyMap[key] = node;
	}

	// if(isElement) {
	// 	const attributes = node.attributes;
	// 	const attrs = data.attrs;
	// 	const newAttrs = data.newAttrs;
	// 	const attrsArr = data.attrsArr;

	// 	for (let i = 0; i < attributes.length; i += 1) {
	// 		const attr = attributes[i];
	// 		const name = attr.name;
	// 		const value = attr.value;

	// 		attrs[name] = value;
	// 		newAttrs[name] = undefined;
	// 		attrsArr.push(name);
	// 		attrsArr.push(value);
	// 	}
	// }

	for (let child = node.firstChild; child; child = child.nextSibling) {
		importNode(child);
	}
}

const nextComponentStart = function(componentCls) {
	nextComponent = new componentCls(null, null)
	return nextComponent
}

const nextComponentEnd = function() {
	nextComponent = null
}

export {
	getData,
	initData,
	importNode,
	component,
	nextComponentStart,
	nextComponentEnd
}
