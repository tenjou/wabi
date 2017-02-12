import { store } from "./store";
import { update } from "./renderer";

let nextComponentDataHolder = {
	ref: null,
	attributes: null,
	key: null,
	statics: null
}
let nextComponentData = null

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
				this.updateState(key, value)
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
	/**
	 * The attributes and their values.
	 * @const {!Object<string, *>}
	 */
	this.attrs = Object.create(null);

	/**
	 * An array of attribute name/value pairs, used for quickly diffing the
	 * incomming attributes to see if the DOM node's attributes need to be
	 * updated.
	 * @const {Array<*>}
	 */
	this.attrsArr = [];

	/**
	 * The incoming attributes for this Node, before they are updated.
	 * @const {!Object<string, *>}
	 */
	this.newAttrs = Object.create(null);

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

	/**
	 * @type {?string}
	 */
	this.text = null;

	const currState = {}
	for(let key in this.state) {
		currState[key] = this.state[key]
	}

	this.$ = currState;

	this._bind = null;
}

NodeData.prototype = 
{
	state: {
		value: null
	},

	remove() {
		if(this._bind) {
			store.unwatch(this._bind)
		}
	},

	setState(state, value)
	{
		if(this.$[state] === value) { return; }

		if(this._bind) {
			store.set(this._bind, value);
		}
		else {
			this.updateState(state, value);
		}
	},

	updateState(state, value)
	{
		this.$[state] = value;
		update();
	},

	set $value(value) {
		this.setState("value", value);
	},

	get $value() {
		return this.$.value
	},

	handleAction(payload) {
		this.updateState("value", payload.value)
	},

	set bind(value) 
	{
		if(this._bind) {
			store.unwatch(this._bind, this)
		}

		this._bind = value

		if(this._bind) {
			store.watch(this._bind, this)
		}

		this.updateState("value", store.get(this._bind))
	},

	get bind() {
		return this._bind
	}
}

const initData = function(node, nodeName, key)
{
	let data
	if(nextComponentData) {
		data = nextComponentData.ref
		data.nodeName = nodeName
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

	if(isElement) {
		const attributes = node.attributes;
		const attrs = data.attrs;
		const newAttrs = data.newAttrs;
		const attrsArr = data.attrsArr;

		for (let i = 0; i < attributes.length; i += 1) {
			const attr = attributes[i];
			const name = attr.name;
			const value = attr.value;

			attrs[name] = value;
			newAttrs[name] = undefined;
			attrsArr.push(name);
			attrsArr.push(value);
		}
	}

	for (let child = node.firstChild; child; child = child.nextSibling) {
		importNode(child);
	}
}

const nextComponentStart = function(component, attributes, key, statics) {
	nextComponentData = nextComponentDataHolder
	nextComponentData.ref = new component(null, key)
	nextComponentData.attributes = attributes
	nextComponentData.key = key
	nextComponentData.statics = statics
	return nextComponentData.ref
}

const nextComponentEnd = function() {
	nextComponentData = null
}

const useNextComponentData = function() 
{
	if(!nextComponentData) { return null }
	
	let tmp = nextComponentData
	nextComponentData = null
	return tmp
}

export {
	getData,
	initData,
	importNode,
	component,
	nextComponentStart,
	nextComponentEnd,
	useNextComponentData
}
