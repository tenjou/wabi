import { Data, Watcher } from "./data";
import { ElementEvent } from "./event";

export { Data, Watcher, ElementEvent };

const globalData = {};
const elementsCached = {};
const elementDefs = {};
const fragments = {};
const templates = {};
const listeners = {};

function ElementMetadata(name) 
{
	this.name = name;
	this.states = null;
	this.stateCls = null;
	this.statesLinked = null;
	this.elements = null;
	this.elementsLinked = null;
	this.elementsBinded = null;
	this.events = null;
	this.deps = null;
}

function Fragment(id, extend, props)
{
	this.id = id;
	this.props = props;

	if(extend) 
	{
		if(typeof(extend) === "string") {
			this.extend = [ extend ];
		}
		else {
			this.extend = extend;
		}
	}
	else {
		this.extend = null
	}
}

function ElementDef(props, extend)
{
	this.props = props;
	this.extend = extend;
}

export function addTemplate(id, extend, props)
{
	if(!id) {
		console.warn("(Wabi.addTemplate) Invalid template id passed");
		return false;
	}

	if(typeof(extend) === "object") {
		props = extend;
		extend = null;
	}

	if(!props.type) {
		console.warn("(Wabi.addTemplate) Invalid template type passed");
		return false;
	}		

	if(this.templates[id]) {
		console.warn("(Wabi.addTemplate) There is already added template with such id: " + props.id);
		return false;
	}

	this.templates[id] = props;

	return true;
}

export function createTemplate(id)
{
	const props = this.templates[id];
	if(!props) {
		console.warn("(Wabi.createTemplate) Template not found: " + id);
		return null;
	}

	const template = createElement(props.type);
	template.flags |= template.Flag.REGION;

	for(const key in props) 
	{
		if(key === "type") { continue; }
		
		template[key] = props[key];
	}

	return template;
}

export function createData(data) {
	return new Data(data || {});
}

export function addFragment(id, extend, props)
{
	if(!id) {
		console.warn("(Wabi.addFragment) Invalid fragment id passed");
		return false;
	}	

	if(this.fragments[id]) {
		console.warn("(Wabi.addFragment) There is already added fragment with such id: " + id);
		return false;
	}

	if(!props) {
		props = extend;
		extend = null;
	}

	this.fragments[id] = new Fragment(id, extend, props);

	return true;
}

export function getFragment(id) 
{
	const fragment = this.fragments[id];
	if(!fragment) {
		console.warn("(Wabi.getTemplate) Could not find fragment with id: " + id);
		return null;
	}

	if(fragment.extend) 
	{
		const props = this.extendFragment([], fragment.extend);
		props = this.appendProps(props, fragment.props);
		return props;
	}

	return fragment.props;
}

function extendFragment(props, extend)
{
	for(let n = 0; n < extend.length; n++)
	{
		const fragment = fragments[extend[n]];
		if(!fragment) {
			console.warn("(Wabi.extendFragment) Could not find fragment with id: " + fragment.id);
			continue;
		}
		else 
		{
			if(fragment.extend) {
				props = extendFragment(props, fragment.extend);
			}

			props = appendProps(props, fragment.props);
		}
	}

	return props;
}

function appendProps(props, fragmentProps)
{
	if(fragmentProps instanceof Array) {
		props = props.concat(fragmentProps);
	}
	else {
		props.push(fragmentProps);
	}
	
	return props;
}

export function createElement(name, parent, params)
{
	let element;

	const buffer = elementsCached[name];
	if(buffer && buffer.length > 0) 
	{
		element = buffer.pop();
		if(element) 
		{
			element.flags = element.flagsInitial;

			if(parent) {
				element.parent = parent;
			}
		}
	}
	else 
	{
		const cls = WabiElement[name];
		if(!cls) {			
			console.warn("(Wabi.createElement) No such element found: " + name);
			return null;
		}

		element = new WabiElement[name](parent, params);
	}

	element._setup();

	return element;
}

export function removeElement(element)
{
	if(!element || !(element instanceof WabiElement.basic)) {
		return console.warn("(Wabi.removeElement) Invalid element passed");
	}

	element._remove();

	let buffer = elementsCached[element._metadata.name];
	if(!buffer) {
		buffer = [ element ];
		elementsCached[element._metadata.name] = buffer;
	}
	else {
		buffer.push(element);
	}
}

export function on(name, func, owner)
{
	if(!func) {
		console.warn("(Wabi.on) Invalid callback function passed");
		return;
	}

	let buffer = listeners[name];
	if(!buffer) 
	{
		const eventName = "on" + name;
		if(window[eventName] === void(0)) { 
			console.warn("(Wabi.on) No such global event available: " + name);
			return;
		}

		buffer = [ new Watcher(owner, func) ];
		listeners[name] = buffer;

		window[eventName] = function(domEvent) 
		{
			var event = new ElementEvent(name, null, domEvent);
			for(var n = 0; n < buffer.length; n++) {
				var watcher = buffer[n];
				watcher.func.call(watcher.owner, event);
			}
		}
	}
	else 
	{
		buffer.push(new Watcher(owner, func));
	}
}

export function off(name, func, owner)
{
	if(!func) {
		return console.warn("(Wabi.on) Invalid callback function passed");
	}

	const buffer = listeners[name];
	if(!buffer) {
		return console.warn("(Wabi.off) No listeners found for event: " + name);
	}

	const num = buffer.length;
	for(let n = 0; n < num; n++)
	{
		const listener = buffer[n];
		if(listener.func === func && listener.owner === owner)
		{
			buffer[n] = buffer[num - 1];
			buffer.pop();
			break;
		}
	}
}

export function element(name, extend, props) 
{
	if(props === undefined) {
		props = extend;
		extend = null;
	}

	if(elementDefs[name]) {
		console.warn("(Wabi.element) There is already defined element with such name: " + name);
		return;
	}

	const elementDef = new ElementDef(props, extend);
	elementDefs[name] = elementDef;

	if(name === "basic") {
		compileBasicElement(props, extend);
	}
	else {
		compileElement(name, props, extend);
	}
}

const WabiElement = element;

function genPrototype(name, extend, props)
{
	if(extend) 
	{
		const extendedDef = elementDefs[extend];
		if(!extendedDef) {
			console.warn("(Wabi.genPrototype) Extended class not found: " + extend);
			return;
		}

		const newProps = {};
		assignObj(newProps, extendedDef.props);
		assignObj(newProps, props);
		props = newProps;
	}		

	const states = {};
	const statesLinked = {};
	const elementsLinked = {};
	const elementsBinded = {};
	const elements = {};
	const events = [];
	const proto = {};
	const deps = {};
	let numElements = 0;
	let valueLinked = false;

	if(props.elements) 
	{
		const elementsProps = props.elements;
		for(let elementKey in elementsProps)
		{
			const elementSlotId = elementKey;
			const item = elementsProps[elementSlotId];
			const state = {};
			const watch = {};
			const params = {};

			let link = null;
			let type = null;
			let bind = null;

			if(!item) {}
			else if(typeof item === "string") {
				type = item;
			}
			else
			{
				if(item.type) { type = item.type; }
				if(item.link) { link = item.link; }
				if(item.bind) { bind = item.bind; }

				const watchKeyword = "watch_";
				const watchKeywordLength = watchKeyword.length;

				for(const key in item)
				{
					if(key === "type" || key === "link" || key === "bind") { continue; }

					if(key[0] === "$") {
						state[key.slice(1)] = item[key];
					}
					else if(key.indexOf(watchKeyword) > -1) {
						watch[key.slice(watchKeywordLength)] = item[key];
					}
					else {
						params[key] = item[key];
					}
				}
			}

			const newItem = { 
				type: type,
				link: link,
				slot: numElements++,
				state: state,
				watch: watch,
				params: params
			};

			if(link)
			{
				statesLinked[link] = elementKey;
				elementsLinked[elementKey] = link;
			}

			if(bind) {
				elementsBinded[elementKey] = bind;
			}

			elements[elementSlotId] = newItem;
		}

		delete props.elements;
	}

	// Defines states:
	const statesDefined = props.state;
	const statesInitial = statesDefined;
	if(statesDefined)
	{
		for(const key in statesDefined) {
			states[key] = statesDefined[key];
		}
	}

	// Define properties:
	for(const key in props)
	{
		const p = Object.getOwnPropertyDescriptor(props, key);
		if(p.get || p.set) {
			Object.defineProperty(proto, key, p);
			continue;
		}

		const variable = props[key];
		const variableType = typeof(variable);

		if(variableType === "function")
		{
			const buffer = key.split("_");
			if(buffer.length > 1 && buffer[0] !== "")
			{
				const stateName = buffer[1];

				if(buffer[0] !== "handle") 
				{
					if(states[stateName] === undefined) {
						states[stateName] = null;
					}
				}
				else {
					events.push(stateName);
				}
			}
		}

		proto[key] = variable;
	}
	
	let statesProto;

	if(name !== "basic")
	{
		const basicMetadata = WabiElement.basic.prototype._metadata;
		const basicStates = basicMetadata.states;

		statesProto = Object.assign({}, basicStates);
		statesProto = Object.assign(statesProto, states);
	}
	else 
	{
		statesProto = states;			
	}

	if(proto.render) 
	{
		const reg = /this\.\$([a-zA-Z]*)/g;
		let result = reg.exec(proto.render);
		while(result) 
		{
			deps[result[1]] = true;
			result = reg.exec(proto.render);
		}
	}

	const bindsForElement = {};
	for(let key in elementsBinded) {
		bindsForElement[elementsBinded[key]] = key; 
	}

	// Create metadata:
	const metadata = new ElementMetadata(name);
	metadata.states = statesProto;
	metadata.statesLinked = statesLinked;
	metadata.statesInitial = statesInitial;
	metadata.elementsLinked = elementsLinked;
	metadata.elementsBinded = elementsBinded;
	metadata.bindsForElement = bindsForElement;
	metadata.deps = deps;

	if(numElements > 0) {
		metadata.elements = elements;
	}
	if(events.length > 0) {
		metadata.events = events;
	}

	proto._metadata = metadata;
	return proto;
}

function compileBasicElement(props, extend)
{
	const proto = genPrototype("basic", extend, props);

	proto.flagsInitial = (proto.Flag.ENABLED);
	proto.flags = proto.flagsInitial;

	WabiElement.basic.prototype = proto;
}

function compileElement(name, props, extend)
{
	function element(parent, params) {
		WabiElement.basic.call(this, parent, params);
	};

	const elementProto = genPrototype(name, extend, props);

	element.prototype = Object.create(WabiElement.basic.prototype);
	element.prototype.constructor = element;

	const proto = element.prototype;

	for(const key in elementProto)
	{
		const p = Object.getOwnPropertyDescriptor(elementProto, key);
		if(p.get || p.set) {
			Object.defineProperty(proto, key, p);
			continue;
		}

		proto[key] = elementProto[key];
	}

	proto.deps = {};
	proto.depStates = {};

	// Generate setters:
	const metadata = elementProto._metadata;
	const statesLinked = metadata.statesLinked;
	const states = metadata.states;
	const statesProto = {};

	for(const key in statesLinked) 
	{
		if(!states[key]) {
			states[key] = undefined;
		}
	}

	for(const key in states) 
	{
		const stateValue = states[key];
		const stateValueType = typeof stateValue;

		const link = statesLinked[key];
		if(link) {
			statesProto[key] = null;
			defStateLink(proto, key, link);
		}
		else 
		{
			switch(stateValueType)
			{
				case "string":
				case "object":
					statesProto[key] = null;
					break;

				case "number":
					statesProto[key] = 0;
					break;

				case "boolean":
					statesProto[key] = false;
					break;

				default:
					console.warn("(Wabi.compileElement) Unhandled stateValueType `" + stateValueType + "` for element: " + name);
					statesProto[key] = null;
					break;
			}

			defState(proto, key);
		}
	}

	function state() {};
	state.prototype = statesProto;
	metadata.stateCls = state;

	WabiElement[name] = element;
}

function defState(proto, key)
{
	Object.defineProperty(proto, "$" + key, 
	{
		set: function(value) {
			this._updateState(key, value);
		},
		get: function() {
			return this._$[key];
		}
	});	
}

function defStateLink(proto, key, link)
{
	Object.defineProperty(proto, "$" + key, 
	{
		set: function(value) 
		{
			const element = this.elements[link];
			if(element) {
				element.$value = value;
			}
			else {
				this._updateState(key, value);
			}
		},
		get: function() {
			return this.elements[link].$value;
		}
	});	
}

function assignObj(target, src)
{
	for(const key in src) 
	{
		const prop = Object.getOwnPropertyDescriptor(src, key);
		if(prop.get || prop.set) {
			Object.defineProperty(target, key, prop);
			continue;
		}

		target[key] = src[key];
	}
}

WabiElement.basic = function(parent, params)
{
	if(this.create) {
		this.create(params);
	}
	
	if(!this.domElement) {
		this.domElement = document.createElement(this.tag ? this.tag : this._metadata.name);
	}

	this.domElement.holder = this;
	this._$ = new this._metadata.stateCls();

	if(parent) {
		this.parent = parent;
	}

	// Load events:
	const events = this._metadata.events;
	if(events)
	{
		for(let n = 0; n < events.length; n++) {
			this._addEvent(events[n]);
		}		
	}

	if(this.prepare) {
		this.prepare();
	}
};
