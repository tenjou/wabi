import { store } from "./store";
import { update } from "./router";

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
	this.nodeName = nodeName
	this.attributes = Object.create(null)
	this.parentAttributes = null
	this.staticsApplied = false

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

	this.bindFuncs = Object.create(null)

	/**
	 * Whether or not the keyMap is currently valid.
	 * @type {boolean}
	 */
	this.keyMapValid = true;

	/**
	 * The node name for this node.
	 * @const {string}
	 */
	
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
		const bindings = this.attributes.bind
		if(bindings)
		{
			if(typeof bindings === "string") {
				store.unwatch(bindings, this.bindFuncs.value)
			}
			else
			{
				for(let key in bindings) {
					store.unwatch(bindings[key], this.bindFuncs[key])
				}
			}

			this.bindFuncs = null
		}
	},

	setState(state, value)
	{
		if(this.$[state] === value) { return }

		if(this.attributes.bind)
		{
			if(typeof this.attributes.bind === "string")
			{
				if(state === "value") {
					store.set(this.attributes.bind, value)
				}
				else {
					this.$[state] = value
					update()
				}
			}
			else
			{
				const binding = this.attributes.bind[state]
				if(binding) {
					store.set(binding, value)
				}
				else {
					this.$[state] = value
					update()
				}
			}
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

	handleAction(state, value) {
		this.$[state] = value
		update()
	},

	set bind(value)
	{
		const prevBind = this.attributes.bind

		if(prevBind)
		{
			if(value)
			{
				if(typeof prevBind === "string")
				{
					if(prevBind !== value) {
						const func = this.bindFuncs.value
						store.unwatch(prevBind, func)
						store.watch(value, func)
					}	
					
					this.$.value = store.get(value)
				}
				else
				{
					for(let key in prevBind)
					{
						const bindPath = value[key]
						if(prevBind[key] !== bindPath)
						{
							const func = this.bindFuncs[key]
							store.unwatch(prevBind[key], func)
							store.watch(bindPath, func)
						}

						this.$[key] = store.get(bindPath)
					}
				}
			}
			else
			{
				if(typeof prevBind === "string") {
					store.unwatch(prevBind, this.bindFuncs.value)
					this.$.value = this.state.value
				}
				else
				{
					for(let key in prevBind) {
						store.unwatch(prevBind[key], this.bindFuncs[key])
						delete this.bindFuncs[key]
						this.$[key] = this.state[key]
					}
				}
			}
		}
		else
		{
			if(typeof value === "string")
			{
				const func = (payload) => {
					this.handleAction("value", payload.value)
				}

				this.bindFuncs.value = func
				store.watch(value, func)
				this.$.value = store.get(value)
			}
			else
			{
				for(let key in value)
				{
					const bindValue = value[key]
					const func = (payload) => {
						this.handleAction(key, payload.value)
					}

					this.bindFuncs[key] = func
					store.watch(bindValue, func)
					this.$[key] = store.get(bindValue)
				}
			}
		}
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

const getData = function(node) 
{
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

const haveNextComponent = function() {
	return nextComponent
}

export {
	getData,
	initData,
	importNode,
	component,
	nextComponentStart,
	nextComponentEnd,
	haveNextComponent
}
