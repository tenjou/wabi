"use strict";

wabi.element.basic = function(parent, createParams)
{	
	if(this.create) {
		this.create(createParams);
	}
	else {
		this.domElement = document.createElement(this.tag);
	}	
	
	this.initState();

	this.parent = parent;

	if(this.initialEvents)
	{
		for(var n = 0; n < this.initialEvents.length; n++) {
			var eventId = this.initialEvents[n];
			this.domElement["on" + eventId] = this.genEventFunc(eventId);
		}
	}

	if(this.setup) {
		this.setup();
	}
};

wabi.element.basic.prototype = 
{
	initState: function()
	{
		if(this.state && this.parent && this.id) 
		{
			this._state = new wabi.state();
			this._stateSetters = {};
			this.genStateFuncs("value", this.domElement);

			this.parent.state[this.id] = this._state;
		}
		else {
			this._state = new wabi.state();
			this._stateSetters = {};
			this.genStateFuncs("value", this.domElement);
		}
		
		if(this._stateValues)
		{
			var prevValue = this._stateValues.value;
			this._stateValues = {
				value: prevValue
			};
		}
		else
		{
			this._stateValues = {
				value: null
			};
		}
	},

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
		childHolder.domElement.appendChild(this.domElement);
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

		if(parentHolder._data) {
			this._data = parentHolder._data;
		}
		
		parentHolder.domElement.appendChild(this.domElement);	

		if(this.id) 
		{
			Object.defineProperty(parentHolder._state, this.id, {
				set: function(value) {
					console.log("here", value)
				},
				get: function() {
					return "";
				}
			});
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
		this.domElement.removeChild(child.domElement);
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

	genEventFunc: function(name, func) 
	{
		var self = this;

		return function(domEvent) 
		{
			domEvent.stopPropagation();

			var event = self.createEvent(name, domEvent);

			var func = this["handle_" + name];
			if(func) {
				func.call(self, event);
			}
			
			self.emit(name, event);
		};
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

	emit: function(name, event)
	{
		if(this.events) 
		{
			var eventBuffer, buffer;

			if(this.events[event.name]) {
				eventBuffer = this.events[event.name];
			}
			else if(this.events["*"]) {
				eventBuffer = this.events["*"];
			}

			if(eventBuffer)
			{
				var stop = false;

				buffer = eventBuffer[event.id];
				if(buffer) 
				{
					for(var n = 0; n < buffer.length; n++) 
					{
						if(buffer[n](event)) {
							stop = true;
						}
					}
				}
				
				buffer = eventBuffer["*"];
				if(buffer) 
				{
					for(var n = 0; n < buffer.length; n++) 
					{
						if(buffer[n](event)) {
							stop = true;
						}
					}
				}

				if(stop) {
					return;
				}
			}
		}
	},

	on: function(event, id, cb)
	{
		if(!cb && typeof(id) === "function") {
			cb = id;
			id = "*";
		}

		if(!this.events) {
			this.events = {};
		}

		if(this._domEvents[event] && !this.domElement["on" + event]) {
			this.domElement["on" + event] = this.genEventFunc(event);
		}

		var eventBuffer = this.events[event];
		if(!eventBuffer) {
			eventBuffer = {};
			this.events[event] = eventBuffer;
		}

		if(eventBuffer[id]) {
			eventBuffer[id].push(cb);
		}
		else {
			eventBuffer[id] = [ cb ];
		}
	},

	set id(id)
	{
		if(this._id === id) { return; }

		if(this.parent) 
		{
			if(this.id) {

			}
			else 
			{
				var self = this;
				Object.defineProperty(this.parent._state, id, {
					set: function(value) {
						self.state = value;
					},
					get: function() {
						return self._state;
					},
					enumerable: true 
				});
			}
		}

		this._id = id;
	},

	get id() {
		return this._id;
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

	_setStateFunc: function(name, value, func)
	{
		if(this._stateValues[name] === value) { return; }

		if(this._data)
		{
			if(typeof(this._bind) === "string" && name === "value") {
				this._data.set(this._bind, value);
			}
			else 
			{
				var dataBindName = this._bind[name];
				if(dataBindName) {
					this._data.set(dataBindName, value);
				}				
			}
		}
		else {
			this._stateSetters[name](value);
		}
	},

	_stateSetterFunc: function(name, value, func)
	{
		this._stateValues[name] = value;

		if(func) {
			func.call(this, value);
		}
	},

	genStateFuncs: function(name) 
	{
		var self = this;
		var func = this["process_" + name];

		Object.defineProperty(this._state, name, {
			set: function(value) {
				self._setStateFunc(name, value, func);
			},
			get: function() {
				return self._stateValues[name];
			},
			enumerable: true 
		});

		this._stateSetters[name] = function(value) {
			self._stateSetterFunc(name, value, func)
		};
	},	

	set state(state) 
	{
		if(state === void(0)) { return; }

		if(state instanceof wabi.state)
		{


			// for(var key in this._state) 
			// {
			// 	if(this._state[key] === void(0)) {
			// 		this.genStateFuncs(key, null);
			// 	}
				
			// 	this._state[key] = state;
			// }
		}
		else
		{
			this._state.value = state;
		}
	},

	get state() {
		return this._state;
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
		if(this._data === data) { return; }

		if(this._data) {
			this._data.unwatch(this);
		}

		this._data = data;

		if(data)
		{
			data.watch(this);

			if(this._bind)
			{
				if(typeof(this._bind) === "string") 
				{
					if(data.get(this._bind)) {
						this.state.value = data.get(this._bind);
					}
				}
				else
				{

				}
			}
		}

		if(this.children)
		{
			for(var n = 0; n < this.children.length; n++) {
				this.children[n].data = data;
			}
		}
	},

	get data() {
		return this._data;
	},

	handleDataChange: function(key, value)
	{
		if(!this._bind) { return; }

		var func;
		if(typeof(this._bind) === "string") 
		{
			if(key !== this._bind) { return; }

			func = this._stateSetters;
		}
		else
		{
			var stateKey = this._bind[key];
			if(!stateKey) { return; }

			func = this.state[stateKey];
		}

		if(func) {
			func.value(value);
		}
	},

	set bind(bind)
	{
		if(this._bind === bind) { return; }
		this._bind = bind;

		if(!this._data) { return; }

		if(typeof(this._bind) === "string") 
		{
			if(this._data.get(this._bind)) {
				this.state.value = this._data.get(this._bind);
			}
		}
		else
		{
			for(var key in this._bind) {

			}
		}
	},

	get bind() {
		return this._bind;
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
	_id: null,
	tag: "_",
	events: null,
	initialEvents: null,

	domElement: null,
	children: null,

	_parent: null,
	_cfg: null,
	_data: null,
	_state: null,
	_stateValues: null,
	_stateSetters: null,
	_bind: null,

	_hidden: false,

	//
	_domEvents: {
		click: true,
		contextmenu: true,
		dragstart: true,
		dragleave: true,
		drop: true
	}
};

Element.prototype.holder = null;
