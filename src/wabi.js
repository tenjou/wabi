import { Data, Watcher, setDataProxy as dataProxy } from "./data";
import ElementEvent from "./event";

export { Watcher, ElementEvent, dataProxy };

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

	for(let key in props)
	{
		if(key === "type") { continue; }

		template[key] = props[key];
	}

	return template;
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

		element = new cls(parent, params);
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

				for(let key in item)
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

	// Define properties:
	for(let key in props)
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
		statesProto = Object.assign(statesProto, props.state);
	}
	else {
		statesProto = states;
	}

	for(let key in elementsLinked) {
		if(statesProto[key] === undefined) {
			statesProto[key] = null;
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
	metadata.elementsLinked = elementsLinked;
	metadata.elementsBinded = elementsBinded;
	metadata.bindsForElement = bindsForElement;

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

	proto.flagsInitial = proto.Flag.ENABLED;
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

	for(let key in elementProto)
	{
		const p = Object.getOwnPropertyDescriptor(elementProto, key);
		if(p.get || p.set) {
			Object.defineProperty(proto, key, p);
			continue;
		}

		proto[key] = elementProto[key];
	}

	// Generate setters:
	const metadata = elementProto._metadata;
	const statesLinked = metadata.statesLinked;
	const states = metadata.states;

	for(let key in states)
	{
		const link = statesLinked[key];
		if(link) {
			defStateLink(proto, key, link);
		}
		else {
			defState(proto, key);
		}
	}

	function state() {};
	state.prototype = states;
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
	for(let key in src)
	{
		const prop = Object.getOwnPropertyDescriptor(src, key);
		if(prop.get || prop.set) {
			Object.defineProperty(target, key, prop);
			continue;
		}

		target[key] = src[key];
	}
}

export function selectElementContents(element)
{
	const range = document.createRange();
	range.selectNodeContents(element);

	const selection = window.getSelection();
	selection.removeAllRanges();
	selection.addRange(range);
};


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

function AppendInfo(element, query)
{
	this.element = element;
	this.query = query;
}

let elementsRenderNum = 0;
let elementsBindNum = 0;
const elementsRender = Array(16);
const elementsBind = Array(16);
const elementsAppend = [];
export const globalData = new Data();

export function data(key, obj)
{
	if(!obj) {
		globalData.__syncAsObject(key);
	}
	else 
	{
		const data = globalData.getData(key);
		if(!data) { return; }

		data.__syncAsObject(obj);
	}
}

export function appendElement(element, query) 
{
	let appendInfo = element._appendInfo;
	if(!appendInfo) {
		appendInfo = new AppendInfo(element, query);
		element._appendInfo = appendInfo;
		elementsAppend.push(appendInfo);
	}
	else {
		appendInfo.query = query;
	}
}

export function renderElement(element) 
{
	if(elementsRender.length === elementsRenderNum) {
		elementsRender.length += 16;
	}

	elementsRender[elementsRenderNum] = element;
	elementsRenderNum++;
}

export function bindElement(element) 
{
	if(elementsBind.length === elementsBindNum) {
		elementsBind.length += 16;
	}

	elementsBind[elementsBindNum] = element;
	elementsBindNum++;
}

function render() 
{
	if(elementsBindNum !== 0)
	{
		for(let n = 0; n < elementsBindNum; n++) {
			elementsBind[n].updateBindings();
		}

		elementsBindNum = 0;
	}

	if(elementsRenderNum !== 0)
	{
		for(let n = 0; n < elementsRenderNum; n++) {
			elementsRender[n].renderElement();
		}

		elementsRenderNum = 0;
	}

	if(elementsAppend.length !== 0)
	{
		for(let n = 0; n < elementsAppend.length; n++) 
		{
			const appendInfo = elementsAppend[n];

			if(!appendInfo.element._appendInfo) { continue; }
			appendInfo.element._appendInfo = null;

			const parentElement = document.querySelector(appendInfo.query);
			if(!parentElement) {
				console.warn("(wabi) Could not find parent from query: " + appendInfo.query);
				continue;
			}

			appendInfo.element.appendTo(parentElement);
		}

		elementsAppend.length = 0;
	}

	window.requestAnimationFrame(render);
}

render();
