"use strict";

var wabi = 
{
	addFragment: function(props)
	{
		if(!props.id) {
			console.warn("(wabi.addFragment) Invalid fragment id passed");
			return false;
		}

		if(!props.type) {
			console.warn("(wabi.addFragment) Invalid fragment type passed");
			return false;
		}		

		if(this.fragments[props.id]) {
			console.warn("(wabi.addFragment) There is already added fragment with such id: " + props.id);
			return false;
		}

		this.fragments[props.id] = props;

		return true;
	},

	createFragment: function(id)
	{
		var props = this.fragments[id];
		if(!props) {
			console.warn("(wabi.createFragment) Fragment not found: " + id);
			return null;
		}

		var fragment = this.fragmentsCached[id];
		if(fragment) {
			return fragment;
		}

		var element = this.element[props.type];
		if(!element) {
			console.warn("(wabi.createFragment) Element type not found: " + props.type);
			return null;
		}

		fragment = new element(null);

		// var contentData = [];
		// var extendBuffer = contentProps.extend;
		// if(extendBuffer && extendBuffer.length > 0) 
		// {
		// 	var extendContentInfo;
		// 	for(var n = 0; n < extendBuffer.length; n++) 
		// 	{
		// 		extendContentInfo = this.getContentInfo(extendBuffer[n]);
		// 		if(!extendContentInfo) { continue; }

		// 		if(extendContentInfo.ctrl) {
		// 			content.addCtrl(extendContentInfo.ctrl);
		// 		}
				
		// 		meta.appendObject(contentData, extendContentInfo.data);
		// 	}
		// }

		// if(contentProps.ctrl) {
		// 	content.addCtrl(contentProps.ctrl);
		// }
		
		// contentData = contentData.concat()

		var contentData = props;

		fragment.cfg = contentData;
		// this.fragmentsCached[id] = fragment;

		return fragment;
	},

	createElement: function(name, parent, params)
	{
		var cls = wabi.element[name];
		if(!cls) {
			console.warn("(editor.createElement) Invalid element requested: " + name);
			return null;
		}

		return new wabi.element[name](parent, params);
	},

	element: function(name, props) 
	{
		var metadata = new this.metadata(name);

		// define element:
		function element(parent, createParams) {
			wabi.element.basic.call(this, parent, createParams);
		};

		element.prototype = Object.create(this.element.basic.prototype);
		element.prototype.constructor = element;
		element.prototype.__metadata = metadata;
		this.element[name] = element;

		// define state:
		function state(parent) {
			wabi.state.call(this, parent);
		};

		state.prototype = Object.create(this.state.prototype);
		state.prototype.constructor = state;
		metadata.stateCls = state;

		// initialize:
		var proto = element.prototype;
		var fnTest = /\b_super\b/;
		var events = [];

		// copy properties:
		for(var key in props)
		{
			var p = Object.getOwnPropertyDescriptor(props, key);
			if(p.get || p.set) {
				Object.defineProperty(proto, key, p);
				continue;
			}

			if(typeof(props[key]) === "function")
			{
				if(fnTest.test(props[key]))
				{
					proto[key] = (function(key, fn)
					{
						return function(a, b, c, d, e, f)
						{
							var tmp = this._super;
							this._super = extendProto[key];
							this._fn = fn;
							var ret = this._fn(a, b, c, d, e, f);

							this._super = tmp;

							return ret;
						};
					})(key, props[key]);
					continue;
				}
				else
				{
					// search for event handlers:
					var searchFor = "handle_";
					var index = key.indexOf(searchFor);
					if(index !== -1) {
						events.push(key.slice(searchFor.length));
					} 					
				}
			}

			proto[key] = props[key];
		}

		// copy params
		var params = Object.assign({ value: null }, props.params);
		element.prototype.params = params;

		// analyse content
		var content = props.content;
		var links = null;
		if(content)
		{
			var elements = {};
			var reverseLinks = {};
			links = {};

			for(var key in content)
			{
				var item = content[key];
				elements[key] = item.type;

				if(links[item.link] !== void(0)) {
					console.warn("(wabi.element) Trying to redefine state link [" + item.link + "] defined for element [" + key + "]");
					continue;
				}

				links[item.link] = key;
				reverseLinks[key] = item.link;

				if(!params[item.link]) {
					params[item.link] = null;
				}
				
				if(item.link === "value") 
				{
					if(element.prototype.process_value === this.element.basic.prototype.process_value) {
						element.prototype.process_value = null;
					}
				}
				
				element.prototype[key] = null;
			}

			metadata.elements = elements;
			metadata.links = reverseLinks;
		}

		// analyse params
		this.genStates(state, params, links);
		
		if(events.length > 0) {
			metadata.events = events;
		}
	},	

	genStates: function(state, params, links)
	{
		var valuesInitial = Object.assign({}, params);
	
		var proto = state.prototype;
		proto.__valuesInitial = valuesInitial;	

		if(links)
		{
			for(var key in params) 
			{
				var link = links[key];

				if(link) {
					valuesInitial[key] = null;
					this.genState(proto, key, params[key], true);
				}
				else {
					this.genState(proto, key, params[key], false);
				}
			}
		}
		else
		{
			for(var key in params) {
				this.genState(proto, key, params[key]);
			}	
		}
	},

	genState: function(proto, name, value, link)
	{
		if(link)
		{
			Object.defineProperty(proto, name, {
				set: function(value)  {
					var state = this.__values[name];
					this.__processLinkState(state, name, value);
				},
				get: function() {
					return this.__values[name];
				}
			});	
		}
		else
		{
			Object.defineProperty(proto, name, {
				set: function(value) {
					this.__updateState(name, value);
				},
				get: function() {
					return this.__values[name];
				}
			});				
		}
	},

	metadata: function(name) {
		this.name = name;
		this.params = null;
		this.events = null;
		this.elements = null;
		this.links = null;
	},

	//
	fragments: {},
	fragmentsCached: {}	
};

// STATE
wabi.state = function(owner) {
	this.__owner = owner;
	this.__values = Object.assign({}, this.__valuesInitial);
};

wabi.state.prototype = 
{
	__processStates: function()
	{
		var values = this.__owner.params;

		for(var key in values)
		{
			var value = values[key];
			if(!value) { continue; }

			var func = this.__owner["process_" + key];
			if(func) {
				func.call(this.__owner, value);
			}

			var state = this.__values[key];
			if(state instanceof wabi.state) {
				this.__updateLinkState(state, value);
			}
		}
	},

	__updateState: function(name, value)
	{
		if(this.__values[name] === value) { return; }

		var data = this.__owner.__data;
		var bind = this.__owner.__bind;

		if(data && bind)
		{
			if(typeof(bind) === "string" && name === "value") {
				data.set(bind, value);
			}
			else 
			{
				var dataBindName = bind[name];
				if(dataBindName) {
					data.set(dataBindName, value);
				}				
			}
		}
		else {
			this.__setState(name, value);
		}
	},

	__updateLinkState: function(state, value)
	{
		if(typeof(value) === "object" && !(value instanceof Array))
		{
			for(var key in value) {
				state[key] = value[key];
			}
		}
		else {
			state.value = value;
		}
	},

	__processLinkState: function(state, name, value)
	{
		var func = this.__owner["process_" + name];
		if(func) {
			func(value);
		}

		if(typeof(value) === "object" && !(value instanceof Array))
		{
			for(var key in value) {
				state[key] = value[key];
			}
		}
		else {
			state.value = value;
		}
	},

	__setState: function(name, value)
	{
		var prevValue = this.__values[name];
		this.__values[name] = value;

		var func = this.__owner["process_" + name];
		if(func) {
			func.call(this.__owner, value, prevValue);
		}
	},

	set value(value) {
		this.__updateState("value", value);
	},

	get value() {
		return this.__values.value;
	},

	toJSON: function() {
		return this.__values;
	},

	//
	__owner: null,
	__values: null,
	__valuesInitial: null
};

wabi.state.basic = wabi.state;

// DATA
wabi.data = function(data) {
	this.data = data ? data : null;
};

wabi.data.prototype = 
{
	set: function(key, value) 
	{
		this.data[key] = value;

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, key, value);
			}
		}
	},

	add: function(key, value)
	{
		var buffer = this.data[key];
		if(buffer === void(0)) { return; }

		if(buffer instanceof Array) {
			buffer.push(value);
		}
		else if(buffer instanceof Object) {
			buffer[key] = value;
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, key, buffer);
			}
		}		
	},

	get: function(key) {
		var value = this.data[key];
		return value ? value : null;
	},

	watch: function(owner) 
	{
		if(!owner) {
			console.warn("(wabi.data) Invalid owner passed");
			return;
		}

		var func = owner["handleDataChange"];
		if(!func) { func = null; }

		if(this.watchers) {
			this.watchers.push(new this.Info(owner, func));
		}
		else {
			this.watchers = [ new this.Info(owner, func) ];
		}
	},

	unwatch: function(owner)
	{
		if(!this.watchers) { return; }

		var num = this.watchers.length;
		for(var n = 0; n < num; n++) 
		{
			if(this.watchers[n].owner === owner) {
				this.watchers[n] = this.watchers[num - 1];
				this.watchers.pop();
				return;
			}
		}
	},

	toJSON: function() {
		return this.data;
	},

	//
	Info: function(owner, func) 
	{
		this.owner = owner ? owner : null,
		this.func = func;
	},

	//
	watchers: null
};
