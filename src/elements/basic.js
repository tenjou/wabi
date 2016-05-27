"use strict";

wabi.element.basic = function(parent, params)
{	
	var metadata = this.__metadata;
	var links = metadata.links;

	this.__state = new metadata.stateCls(this);

	if(this.create) {
		this.create(params);
	}
	
	if(!this.domElement) {
		this.domElement = document.createElement(this.tag ? this.tag : metadata.name);
	}

	var elements = metadata.elements;
	if(elements)
	{
		this.elements = {};

		for(var key in elements) 
		{
			var element = wabi.createElement(elements[key], this);
			this.elements[key] = element;

			if(!element) { continue; }

			if(links) 
			{
				var link = links[key];
				if(link) {
					this.__state.__values[link] = element.__state;
				}
			}
		}
	}

	if(metadata.events)
	{
		for(var n = 0; n < metadata.events.length; n++) {
			this.addEventFunc(metadata.events[n]);
		}
	}

	this.parent = parent;

	if(this.setup) {
		this.setup();
	}

	this.__state.__processStates();
};

wabi.element.basic.prototype = 
{
	create: null,

	process_value: function(value) {
		this.domElement.innerHTML = value;
	},

	append: function(child) 
	{
		if(!child) {
			console.warn("(element.basic.append) Invalid child passed");
			return;
		}

		var childHolder;
		if(child instanceof Element) 
		{
			childHolder = child.holder;
			if(!childHolder) {
				childHolder = new wabi.element.wrapped(child);
				child.holder = childHolder;
			}
		}
		else {
			childHolder = child;
		}

		if(childHolder.parent && childHolder.parent !== this) {
			console.warn("(element.basic.append) Child has already different parent");
			return;
		}

		if(!this.children) {
			this.children = [ childHolder ];
		}
		else {
			this.children.push(childHolder);
		}

		childHolder._parent = this;

		if(this.__enabled) {
			childHolder.domElement.appendChild(this.domElement);
		}
	},

	appendTo: function(parent)
	{
		if(!parent) {
			console.warn("(element.basic.appendTo) Invalid parent passed");
			return;
		}

		if(this.parent) {
			console.warn("(element.basic.appendTo) Element is already added to different parent");
			return;
		}

		var parentHolder;
		if(parent instanceof Element) 
		{
			parentHolder = parent.holder;
			if(!parentHolder) {
				parentHolder = new wabi.element.wrapped(null, parent);
				parent.holder = parentHolder;
			}
		}
		else {
			parentHolder = parent;
		}	

		if(!parentHolder.children) {
			parentHolder.children = [ this ];
		}
		else {
			parentHolder.children.push(this);
		}

		this._parent = parentHolder;

		if(parentHolder.__data) {
			this.data = parentHolder.__data;
		}
		
		if(this.__enabled && parentHolder.domElement) {
			parentHolder.domElement.appendChild(this.domElement);
		}
	},

	remove: function(child)
	{
		if(!child.parent) {
			console.warn("(element.basic.remove) Child does not have parent");
			return;
		}

		if(child.parent !== this) {
			console.warn("(element.basic.remove) Child has different parent");
			return;
		}

		var index = this.children.indexOf(child);
		if(index === -1) {
			console.warn("(element.basic.remove) Child has not been found - this should not happen");
			return;
		}

		this.children[index] = this.children[this.children.length - 1];
		this.children.pop();

		child._parent = null;

		if(this.__enabled) {
			this.domElement.removeChild(child.domElement);
		}
	},

	removeAll: function()
	{
		if(!this.children) { return; }

		var child;
		for(var n = 0; n < this.children.length; n++) {
			child = this.children[n];
			child._parent = null;
			this.domElement.removeChild(child.domElement);
		}

		this.children.length = 0;
	},

	attrib: function(key, value)
	{
		if(!this.domElement) { 
			console.warn("(wabi.element.attrib) Invalid DOM element");
			return null;
		}

		if(value === void(0)) {
			return this.domElement.getAttribute(key);
		}
		else {
			this.domElement.setAttribute(key, value);
		}
		
		return value;
	},

	style: function(key, value)
	{
		if(!this.domElement) { 
			console.warn("(wabi.element.style) Invalid DOM element");
			return null;
		}

		if(this.domElement.style[key] === void(0)) {
			console.warn("(wabi.element.style) Invalid DOM style:", key);
			return null;
		}

		if(value === void(0)) {
			return this.domElement.style[key];
		}
		else {
			this.domElement.style[key] = value;
		}
		
		return value;
	},

	_processClickEvent: function(domEvent)
	{
		domEvent.stopPropagation();

		var event;
		if(domEvent.detail % 2 === 0) 
		{
			event = this.createEvent("dblclick", domEvent);

			if(this._onDblClick) {
				this._onDblClick(event);
			}

			this.emit("dblclick", event);
		}
		else 
		{
			event = this.createEvent("dblclick", domEvent);

			if(this._onClick) {
				this._onClick(event);
			}

			this.emit("click", event);
		}
	},

	_onClick: null,

	_onDblClick: null,

	addEventFunc: function(eventName) 
	{
		var func = this["handle_" + eventName];

		if(eventName === "click" || eventName === "dblclick")
		{
			if(this.domElement.onclick === null) {
				this.domElement.onclick = this._processClickEvent.bind(this);
			}
			
			if(eventName === "click") {
				this._onClick = func.bind(this);
			}
			else if(eventName === "dblclick") {
				this._onDblClick = func.bind(this);
			}
		}
		else 
		{
			var self = this;
			var eventKey = "on" + eventName;

			if(this.domElement[eventKey] === null) 
			{
				if(func) 
				{
					this.domElement[eventKey] = function(domEvent) 
						{
							domEvent.stopPropagation();

							var event = self.createEvent(eventName, domEvent);
							func.call(self, event);
							self.emit(eventName, event);
						};
				}
				else 
				{
					this.domElement[eventKey] = function(domEvent) 
						{
							domEvent.stopPropagation();

							var event = self.createEvent(eventName, domEvent);
							self.emit(eventName, event);
						};
				}
			}
		}
	},

	createEvent: function(name, domEvent)
	{
		var event = new this.Event(this, name);

		if(domEvent) 
		{
			event.domEvent = domEvent;
			if(domEvent.clientX) 
			{
				event.x = domEvent.clientX;
				event.y = domEvent.clientY;
				this.updateEventElementOffset(event);
			}
			else {
				event.x = 0;
				event.y = 0;
			}
		}	

		return event;	
	},

	updateEventElementOffset: function(event)
	{
		var offsetLeft = 0;
		var offsetTop = 0;

		var domElement = event.element.domElement;
		if(domElement.offsetParent)
		{
			do 
			{
				if(domElement.tagName === "IFRAME") {
					offsetLeft += domElement.offsetLeft;
					offsetTop += domElement.offsetTop;
				}

			} while(domElement = domElement.offsetParent);
		}

		if(event.element.domElement.tagName === "IFRAME") {
			var rect = event.element.domElement.getBoundingClientRect();
			event.x += rect.left;
			event.y += rect.top;
		}
	},	

	emit: function(eventName, event)
	{
		if(!this.listeners) { return; }

		var buffer = this.listeners[eventName];
		if(!buffer) { return; }

		for(var n = 0; n < buffer.length; n++) {
			buffer[n](event);
		}
	},

	on: function(event, cb, owner)
	{
		if(!this.listeners) {
			this.listeners = {};
		}

		var buffer = this.listeners[event];
		if(!buffer) {
			buffer = [];
			this.listeners[event] = buffer;
			this.addEventFunc(event);
		}

		buffer.push(cb.bind(owner));
	},

	off: function(event, owner)
	{

	},

	addCls: function(name) 
	{
		if(!this.domElement) { return; }
		this.domElement.classList.add(name);
	},

	removeCls: function(name) 
	{
		if(!this.domElement) { return; }
		this.domElement.classList.remove(name);
	},

	set parent(parent)
	{
		if(this._parent === parent) { return; }

		if(parent) {
			this.appendTo(parent);
		}
		else 
		{
			if(this.parent) {
				this.parent.remove(this);
			}
		}
	},

	get parent() {
		return this._parent;
	},

	get: function(id) 
	{
		if(!this.children) { return; }

		var element;
		for(var n = 0; n < this.children.length; n++)
		{
			element = this.children[id];
			if(element) {
				return element;
			}
		}

		return null;
	},

	set state(state) {
		this.__state.__updateLinkState(this.__state, state);
	},

	get state() {
		return this.__state;
	},

	set cfg(cfg)
	{
		this._cfg = cfg;
		for(var key in cfg)
		{
			if(this[key] !== void(0) && this[key] !== cfg[key]) {
				this[key] = cfg[key];
			}
		}
	},

	get cfg() {
		return this._cfg;
	},

	set data(data)
	{
		if(this.__data == data) { return; }

		if(this.__bind)
		{
			if(this.__data) {
				this.__data.unwatch(this);
			}

			if(data)
			{
				data.watch(this);

				if(typeof(this.__bind) === "string")
				{
					var value = data.get(this.__bind);
					if(value) {
						this.__state.__setState("value", value);
					}
				}
			}
		}

		this.__data = data;

		if(this.children)
		{
			for(var n = 0; n < this.children.length; n++) {
				this.children[n].data = data;
			}
		}
	},

	get data() {
		return this.__data;
	},

	handleDataChange: function(key, value)
	{
		var type = typeof(this.__bind);
		if(type === "string") 
		{
			if(key !== this.__bind) { return; }

			this.__state.__setState("value", value);
		}
		else if(type === "object")
		{
			if(this.__bind[key] === void(0)) { return; }

			this.__state.__setState(this.__bind[key], value);
		}
	},

	set bind(bind)
	{
		if(this.__bind === bind) { return; }
		this.__bind = bind;

		if(!this.__data) { return; }

		if(typeof(this.__bind) === "string") 
		{
			if(this.__data.get(this.__bind)) {
				this.state.value = this.__data.get(this._bind);
			}
		}
		else
		{
			for(var key in this._bind) {

			}
		}
	},

	get bind() {
		return this.__bind;
	},

	bindState: function(name, value)
	{
		if(!(value instanceof wabi.state)) {
			console.warn("(wabi.state.__bindState) Invalid state object");
			return; 
		}

		if(value.__binded) { 
			console.warn("(wabi.state.__bindState) State is already binded");
			return; 
		}

		this.__state.__bindState(name, value);
	},	

	set hidden(value) 
	{
		if(this._hidden = value) { return; }
		this._hidden = value;

		if(value) {
			this.domElement.classList.add("hidden");
		}
		else {
			this.domElement.classList.remove("hidden");
		}
	},

	get hidden() {
		return this._hidden;
	},

	set enable(value)
	{
		if(this.__enabled === value) { return; }
		this.__enabled = value;

		if(value) {
			this.parent.domElement.appendChild(this.domElement);
		}
		else {
			this.parent.domElement.removeChild(this.domElement);
		}
	},

	get enable() {
		return this.__enabled;
	},

	get: function(id)
	{
		console.log(this.domElement.querySelector(id).holder);
	},

	//
	Event: function(element, name)
	{
		this.element = element;
		this.name = name;
		this.id = "";
		this.domEvent = null;
		this.x = 0;
		this.y = 0;	
	},

	//
	id: null,

	elements: null,
	listeners: null,
	initialEvents: [],

	domElement: null,
	children: null,

	_parent: null,
	_cfg: null,
	__state: null,
	__data: null,
	__bind: null,

	_hidden: false,
	__enabled: true,

	__meta: null
};

Element.prototype.holder = null;
