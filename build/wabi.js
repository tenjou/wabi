"use strict";

var wabi = 
{
	addTemplate: function(id, extend, props)
	{
		if(!id) {
			console.warn("(wabi.addTemplate) Invalid template id passed");
			return false;
		}

		if(typeof(extend) === "object") {
			props = extend;
			extend = null;
		}

		if(!props.type) {
			console.warn("(wabi.addTemplate) Invalid template type passed");
			return false;
		}		

		if(this.templates[id]) {
			console.warn("(wabi.addTemplate) There is already added template with such id: " + props.id);
			return false;
		}

		this.templates[id] = props;

		return true;
	},

	createTemplate: function(id)
	{
		var props = this.templates[id];
		if(!props) {
			console.warn("(wabi.createTemplate) Template not found: " + id);
			return null;
		}

		var template = wabi.createElement(props.type);
		template.flags |= template.Flag.REGION;

		for(var key in props) 
		{
			if(key === "type") { continue; }
			
			template[key] = props[key];
		}

		return template;
	},

	createData: function(data) {
		return new wabi.data(data || {});
	},	

	addFragment: function(id, extend, props)
	{
		if(!id) {
			console.warn("(wabi.addFragment) Invalid fragment id passed");
			return false;
		}	

		if(this.fragments[id]) {
			console.warn("(wabi.addFragment) There is already added fragment with such id: " + id);
			return false;
		}

		if(!props) {
			props = extend;
			extend = null;
		}

		this.fragments[id] = new this.Fragment(id, extend, props);

		return true;
	},

	getFragment: function(id) 
	{
		var fragment = this.fragments[id];
		if(!fragment) {
			console.warn("(wabi.getTemplate) Could not find fragment with id: " + id);
			return null;
		}

		if(fragment.extend) 
		{
			var props = this.extendFragment([], fragment.extend);
			props = this.appendProps(props, fragment.props);
			return props;
		}

		return fragment.props;
	},

	extendFragment: function(props, extend)
	{
		for(var n = 0; n < extend.length; n++)
		{
			var fragment = this.fragments[extend[n]];
			if(!fragment) {
				console.warn("(wabi.extendFragment) Could not find fragment with id: " + fragment.id);
				continue;
			}
			else 
			{
				if(fragment.extend) {
					props = this.extendFragment(props, fragment.extend);
				}

				props = this.appendProps(props, fragment.props);
			}
		}

		return props;
	},

	appendProps: function(props, fragmentProps)
	{
		if(fragmentProps instanceof Array) {
			props = props.concat(fragmentProps);
		}
		else {
			props.push(fragmentProps);
		}
		
		return props;
	},

	createElement: function(name, parent, params)
	{
		var element;
		var buffer = this.elementsCached[name];
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
			var cls = this.element[name];
			if(!cls) {			
				console.warn("(editor.createElement) No such element found: " + name);
				return null;
			}

			element = new this.element[name](parent, params);
		}

		element._setup();

		return element;
	},

	removeElement: function(element)
	{
		if(!element || !(element instanceof wabi.element.basic)) {
			return console.warn("(wabi.removeElement) Invalid element passed");
		}

		element._remove();

		var buffer = this.elementsCached[element._metadata.name];
		if(!buffer) {
			buffer = [ element ];
			this.elementsCached[element._metadata.name] = buffer;
		}
		else {
			buffer.push(element);
		}
	},

	on: function(name, func, owner)
	{
		if(!func) {
			console.warn("(wabi.on) Invalid callback function passed");
			return;
		}

		var buffer = this.listeners[name];
		if(!buffer) 
		{
			var eventName = "on" + name;
			if(window[eventName] === void(0)) { 
				console.warn("(wabi.on) No such global event available: " + name);
				return;
			}

			buffer = [ new this.Watcher(owner, func) ];
			this.listeners[name] = buffer;

			window[eventName] = function(domEvent) 
			{
				var event = new wabi.event(name, null, domEvent);
				for(var n = 0; n < buffer.length; n++) {
					var watcher = buffer[n];
					watcher.func.call(watcher.owner, event);
				}
			}
		}
		else 
		{
			buffer.push(new this.Watcher(owner, func));
		}
	},

	off: function(name, func, owner)
	{
		if(!func) {
			return console.warn("(wabi.on) Invalid callback function passed");
		}

		var buffer = this.listeners[name];
		if(!buffer) {
			return console.warn("(wabi.off) No listeners found for event: " + name);
		}

		var num = buffer.length;
		for(var n = 0; n < num; n++)
		{
			var listener = buffer[n];
			if(listener.func === func && listener.owner === owner)
			{
				buffer[n] = buffer[num - 1];
				buffer.pop();
				break;
			}
		}
	},

	element: function(name, extend, props) 
	{
		if(props === undefined) {
			props = extend;
			extend = null;
		}

		if(this.elementDefs[name]) {
			console.warn("(wabi.element) There is already defined element with such name: " + name);
			return;
		}

		var elementDef = new this.ElementDef(props, extend);
		this.elementDefs[name] = elementDef;

		if(name === "basic") {
			this.compileBasicElement(props, extend);
		}
		else {
			this.compileElement(name, props, extend);
		}
	},	

	// TODO: Re-do how properties are registered.
	genPrototype: function(name, extend, props)
	{
		if(extend) 
		{
			var extendedDef = this.elementDefs[extend];
			if(!extendedDef) {
				console.warn("(wabi.genPrototype) Extended class not found: " + extend);
				return;
			}

			var newProps = {};
			this.assignObj(newProps, extendedDef.props);
			this.assignObj(newProps, props);
			props = newProps;
		}		

		var states = {};
		var statesLinked = {};
		var elementsLinked = {};
		var elementsBinded = {};
		var elements = {};
		var events = [];
		var proto = {};
		var numElements = 0;
		var valueLinked = false;

		if(props.elements) 
		{
			var elementsProps = props.elements;
			for(var elementKey in elementsProps)
			{
				var elementSlotId = elementKey;
				var item = elementsProps[elementSlotId];
				var state = {};
				var watch = {};
				var params = {};

				var link = null;
				var type = null;
				var bind = null;

				if(!item) {}
				else if(typeof item === "string") {
					type = item;
				}
				else
				{
					if(item.type) { type = item.type; }
					if(item.link) { link = item.link; }
					if(item.bind) { bind = item.bind; }

					var watchKeyword = "watch_";
					var watchKeywordLength = watchKeyword.length;

					for(var key in item)
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

				var newItem = { 
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
		var statesDefined = props.state;
		var statesInitial = statesDefined;
		if(statesDefined)
		{
			for(var key in statesDefined) {
				states[key] = statesDefined[key];
			}
		}

		// Define properties:
		for(var key in props)
		{
			var p = Object.getOwnPropertyDescriptor(props, key);
			if(p.get || p.set) {
				Object.defineProperty(proto, key, p);
				continue;
			}

			var variable = props[key];
			var variableType = typeof(variable);

			if(variableType === "function")
			{
				var buffer = key.split("_");
				if(buffer.length > 1 && buffer[0] !== "")
				{
					var stateName = buffer[1];

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

		var statesProto;

		if(name !== "basic")
		{
			var basicMetadata = this.element.basic.prototype._metadata;
			var basicStates = basicMetadata.states;

			statesProto = Object.assign({}, basicStates);
			statesProto = Object.assign(statesProto, states);
		}
		else 
		{
			statesProto = states;			
		}

		var bindsForElement = {};
		for(var key in elementsBinded) {
			bindsForElement[elementsBinded[key]] = key; 
		}

		// Create metadata:
		var metadata = new this.metadata(name);
		metadata.states = statesProto;
		metadata.statesLinked = statesLinked;
		metadata.statesInitial = statesInitial;
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
	},

	compileBasicElement: function(props, extend)
	{
		var proto = this.genPrototype("basic", extend, props);

		proto.flagsInitial = (proto.Flag.ENABLED);
		proto.flags = proto.flagsInitial;

		this.element.basic.prototype = proto;
	},	

	compileElement: function(name, props, extend)
	{
		function element(parent, params) {
			wabi.element.basic.call(this, parent, params);
		};

		var elementProto = this.genPrototype(name, extend, props);

		element.prototype = Object.create(this.element.basic.prototype);
		element.prototype.constructor = element;
		var proto = element.prototype;

		for(var key in elementProto)
		{
			var p = Object.getOwnPropertyDescriptor(elementProto, key);
			if(p.get || p.set) {
				Object.defineProperty(proto, key, p);
				continue;
			}

			proto[key] = elementProto[key];
		}

		proto.deps = {};
		proto.depStates = {};

		// Generate setters:
		var metadata = elementProto._metadata;
		var statesLinked = metadata.statesLinked;
		var states = metadata.states;
		var statesProto = {};

		for(var key in statesLinked) 
		{
			if(!states[key]) {
				states[key] = undefined;
			}
		}

		for(var key in states) 
		{
			var stateValue = states[key];
			var stateValueType = typeof stateValue;

			var link = statesLinked[key];
			if(link) {
				statesProto[key] = null;
				this.defStateLink(proto, key, link);
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
						console.warn("(wabi.compileElement) Unhandled stateValueType `" + stateValueType + "` for element: " + name);
						statesProto[key] = null;
						break;
				}

				this.defState(proto, key);
			}
		}

		function state() {};
		state.prototype = statesProto;
		metadata.stateCls = state;

		this.element[name] = element;
	},

	defState: function(proto, key)
	{
		Object.defineProperty(proto, "$" + key, 
		{
			set: function(value) {
				this._updateState(key, value);
			},
			get: function() 
			{
				let currDep = wabi.currDep;
				if(currDep) 
				{
					let buffer = currDep.buffer[key];
					if(!buffer) {
						buffer = [ currDep.key ];
						currDep.buffer[key] = buffer;
					}
					else {
						buffer.push(currDep.key);
					}
				}

				return this._$[key];
			}
		});	
	},

	defStateLink: function(proto, key, link)
	{
		Object.defineProperty(proto, "$" + key, 
		{
			set: function(value) 
			{
				var element = this.elements[link];
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
	},

	assignObj: function(target, src)
	{
		for(var key in src) 
		{
			var prop = Object.getOwnPropertyDescriptor(src, key);
			if(prop.get || prop.set) {
				Object.defineProperty(target, key, prop);
				continue;
			}

			target[key] = src[key];
		}
	},

	pushDependency(key, dep) 
	{
		let info = this.freeDependencies.pop();
		if(!info) {
			info = new this.Dependency(key, dep);
		}
		else {
			info.key = key;
			info.dep = dep;
		}

		this.currDep = info;
		this.dependencies.push(info);
	},

	popDependency() 
	{
		this.freeDependencies.push(this.dependencies.pop());
		this.currDep = this.dependencies[this.dependencies.length - 1] || null;
	},

	Dependency: function(key, buffer) {
		this.key = key;
		this.buffer = buffer;
	},

	metadata: function(name) 
	{
		this.name = name;
		this.states = null;
		this.stateCls = null;
		this.statesLinked = null;
		this.elements = null;
		this.elementsLinked = null;
		this.elementsBinded = null;
		this.events = null;
	},

	Watcher: function(owner, func) 
	{
		this.owner = owner ? owner : null,
		this.func = func;
	},

	Fragment: function(id, extend, props)
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
	},

	ElementDef: function(props, extend)
	{
		this.props = props;
		this.extend = extend;
	},

	//
	globalData: {},

	elementsCached: {},
	elementDefs: {},

	dependencies: [],
	freeDependencies: [],
	currDep: null,

	fragments: {},
	templates: {},
	listeners: {}
};

"use strict";

"require wabi";

if(!window.wabi) {
	window.wabi = {};
}

wabi.data = function(raw, id, parent) 
{
	this.raw = raw ? raw : {};

	if(id !== undefined) {
		this.id = id;
	}
	else {
		this.id = "";
	}

	if(parent) {
		this.parent = parent;
	}
};

wabi.data.prototype = 
{
	set: function(key, value)
	{
		if(value === void(0)) 
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "set",
					value: key
				});
			} 
			else {
				this.performSet(key);
			}
		}
		else 
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "set",
					key: key,
					value: value
				});
			}
			else {
				this.performSetKey(key, value);
			}
		}
	},

	performSet: function(value) 
	{
		this.raw = value;

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "set", null, value, 0, this);
			}
		}
	},

	performSetKey: function(key, value) 
	{
		if(typeof value === "string") 
		{
			if(value[0] === "*") {
				var ref = new wabi.ref(value, key, this);
				this.raw[key] = ref;
				return ref;
			}
		}

		var index = key.indexOf(".");
		if(index === -1) 
		{
			if(value instanceof Object && !(value instanceof wabi.data)) {
				value = new wabi.data(value, key, this);
			}

			this.raw[key] = value;
		}
		else
		{
			var id;
			var data = this;
			var buffer = key.split(".");
			for(var n = 0; n < buffer.length - 1; n++) 
			{
				id = buffer[n];

				var currData = data.get(id);
				if(!currData) {
					currData = new wabi.data({}, id, data);
					data[id] = currData;
				}

				data = currData;
			}

			id = buffer[n];

			if(value instanceof Object && !(value instanceof wabi.data)) {
				value = new wabi.data(value, id, data);
			}

			data.raw[id] = value;
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "set", key, value, 0, this);
			}
		}

		return value;
	},

	setKeys: function(value)
	{
		if(wabi.dataProxy) 
		{
			wabi.dataProxy({ 
				id: this.genId(),
				type: "data",
				action: "setkeys",
				value: value
			});
		}
		else {
			this.performSetKeys(value);
		}
	},	

	performSetKeys: function(value)
	{
		for(var key in value) {
			this.performSetKey(key, value[key]);
		}
	},

	add: function(key, value)
	{
		if(value === void(0)) 
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "add",
					value: key
				});
			}
			else {
				this.performAdd(key);
			}
		}
		else
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "add",
					key: key,
					value: value
				});
			}
			else {
				this.performAddKey(key, value);
			}
		}
	},

	push: function(key, value)
	{
		var buffer = this.get(key);
		if(!buffer) {
			buffer = new wabi.data([], "content", this);
			this.raw[key] = buffer;
		}
		else
		{
			if(!(buffer.raw instanceof Array)) {
				console.warn("(wabi.data) Key `" + key + "` is not an Array");
				return;
			}
		}

		buffer.add(value);
	},

	performAdd: function(value)
	{
		if(this.raw instanceof Array) 
		{
			if(value instanceof Object && !(value instanceof wabi.data)) {
				value = new wabi.data(value, this.raw.length + "", this);
			}

			this.raw.push(value);
		}
		else 
		{
			console.warn("(wabi.data.performAdd) Can peform add only to Array");
			return;
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "add", null, value, -1, this);
			}
		}	
	},

	performAddKey: function(key, value)
	{
		if(this.raw instanceof Object) 
		{
			if(value instanceof Object && !(value instanceof wabi.data)) {
				value = new wabi.data(value, key, this);
			}
			else if(typeof value === "string" && value[0] === "*") {
				var ref = new wabi.ref(value, key, this);
				this.raw[key] = value;
				value = ref;
			}	

			this.raw[key] = value;
		}
		else 
		{
			console.warn("(wabi.data.performAddKey) Can peform add only to Object");
			return;
		}	

		if(typeof value === "string" && value[0] === "*") {
			var ref = new wabi.ref(value, key, this);
			this.raw[key] = value;
			value = ref;
		}	

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "add", key, value, -1, this);
			}
		}
	},

	remove: function(key)
	{
		// Remove self?
		if(key === undefined) {
			this.parent.remove(this.id);
		}
		else
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "remove",
					key: key
				});
			}
			else {
				this.performRemove(key);
			}
		}
	},

	performRemove: function(key)
	{
		var value = this.raw[key];
		delete this.raw[key];

		if(value instanceof wabi.data)
		{
			var refs = value.refs;
			if(refs)
			{
				for(var n = 0; n < refs.length; n++) {
					refs[n].$remove();
				}

				value.refs = null;
			}
		}
		else if(value instanceof wabi.ref) {
			value = value.instance;
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "remove", key, value, -1, this);
			}
		}	
	},

	removeItem: function(key, id)
	{
		var item = this.raw[key];
		if(typeof(item) !== "object") {
			return;
		}

		if(item instanceof Array) {
			item.splice(id, 1);
		}
		else {
			delete item[id];
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "removeItem", key, null, id, this);
			}
		}
	},

	get: function(index) 
	{
		if(index === "*") {
			return new wabi.data(this.raw, this.id, this.parent);
		}
		else if(index === "@") {
			return this.id;
		}

		var data;
		if(!isNaN(index) && index !== "") 
		{
			data = this.raw[index | 0];

			if(typeof(data) === "object" && !(data instanceof wabi.data)) {
				data = new wabi.data(data, index + "", this);
				this.raw[index] = data;
			}
		}
		else 
		{
			var cursor = index.indexOf(".");
			if(cursor === -1) 
			{
				data = this.raw[index];

				if(data)
				{
					if(typeof data === "object" && !(data instanceof wabi.data)) {
						data = new wabi.data(data, index + "", this);
						this.raw[index] = data;
					}
					else if(typeof data === "string" && data[0] === "*") {
						data = new wabi.ref(data, index, this);
						this.raw[index] = data;
						return data;
					}
				}
			}
			else
			{
				var buffer = index.split(".");
				data = this;
				for(var n = 0; n < buffer.length; n++)
				{
					data = data.getItem(buffer[n]);
				}
			}
		}

		return data;
	},

	getItem: function(id)
	{
		if(id === "*") {
			return new wabi.data(this.raw, this.id, this.parent);
		}

		var data;
		if(!isNaN(id) && id !== "") {
			data = this.raw[id | 0];
		}
		else 
		{
			data = this.raw[id];

			if(!data) {
				if(this.raw.content) {
					data = this.raw.content[id];
				}
			}
		}

		if(typeof(data) === "object" && !(data instanceof wabi.data)) {
			data = new wabi.data(data, id + "", this);
			this.raw[id] = data;
		}

		return data;
	},

	getFromKeys: function(keys)
	{
		var data = this;
		for(var n = 0; n < keys.length; n++) 
		{
			data = data.get(keys[n]);
			if(!data) {
				return null;
			}
		}

		return data;
	},

	genId: function()
	{
		if(!this.parent) { return this.id; }

		var id = this.id;
		var parent = this.parent;
		do 
		{
			if(!parent.id) { return id; }
			
			id = parent.id + "." + id;
			parent = parent.parent;
		} while(parent);

		return id;
	},

	watch: function(func, owner) 
	{
		if(!func) {
			console.warn("(wabi.data.watch) Invalid callback function passed");
			return;
		}
		if(!owner) {
			console.warn("(wabi.data.watch) Invalid owner passed");
			return;
		}

		if(this.watchers) {
			this.watchers.push(new this.Watcher(owner, func));
		}
		else {
			this.watchers = [ new this.Watcher(owner, func) ];
		}
	},

	unwatch: function(func, owner)
	{
		if(!this.watchers) { return; }

		var num = this.watchers.length;
		for(var n = 0; n < num; n++) 
		{
			var info = this.watchers[n];
			if(info.owner === owner && info.func === func) {
				this.watchers[n] = this.watchers[num - 1];
				this.watchers.pop();
				return;
			}
		}
	},

	sync: function() 
	{
		if(this.watchers) 
		{
			for(var n = 0; n < this.watchers.length; n++) {
				var info = this.watchers[n];
				info.func.call(info.owner, "sync", null, null, 0, this);
			}
		}	
	},

	__syncAsArray: function(data)
	{
		this.raw = data;

		if(this.watchers) 
		{
			for(var n = 0; n < this.watchers.length; n++) {
				var info = this.watchers[n];
				info.func.call(info.owner, "set", null, data, 0, this);
			}
		}	
	},

	__syncAsObject: function(data)
	{
		this.raw = {};

		for(var key in data)
		{
			var srcValue = this.raw[key];
			var targetValue = data[key];

			if(srcValue === void(0)) {
				this.raw[key] = targetValue;
			}
			else if(srcValue === targetValue) {
				srcValue = targetValue;
			}

			if(this.watchers) 
			{
				for(var n = 0; n < this.watchers.length; n++) {
					var info = this.watchers[n];
					info.func.call(info.owner, "set", key, targetValue, 0, this);
				}
			}
		}
	},

	removeRef: function(ref)
	{
		if(!this.refs) { 
			console.warn("(wabi.data.removeRef) No references created from this item");
			return;
		}

		var index = this.refs.indexOf(ref);
		this.refs[index] = this.refs[this.refs.length - 1];
		this.refs.pop();
	},

	toJSON: function() {
		return this.raw;
	},

	Watcher: function(owner, func) 
	{
		this.owner = owner ? owner : null,
		this.func = func;
	},

	//
	watchers: null,
	parent: null,
	refs: null
};

wabi.ref = function(path, id, parent) 
{
	this.id = id;
	this.path = path;
	this.parent = parent;

	var refPath = path.slice(1);
	this.instance = wabi.globalData.raw.assets.get(refPath);

	if(this.instance)
	{
		if(this.instance.refs) {
			this.instance.refs.push(this);
		}
		else {
			this.instance.refs = [ this ];
		}
	}
	else {
		console.warn("(wabi.ref) Invalid ref: " + refPath);
	}
};

wabi.ref.prototype = 
{
	remove: function()
	{
		this.instance.removeRef(this);
		this.instance = null;
		this.parent.remove(this.id);
	},

	$remove: function() {
		this.parent.remove(this.id);
	},

	toJSON: function() {
		return this.path;
	}
};

"use strict";

"require ../wabi";

// TODO (maybe): If data or binding is removed reset value?
// TODO: Check if child items can click through

wabi.element.basic = function(parent, params)
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
	var events = this._metadata.events;
	if(events)
	{
		for(var n = 0; n < events.length; n++) {
			this._addEvent(events[n]);
		}		
	}

	if(this.prepare) {
		this.prepare();
	}
};

wabi.element("basic", 
{
	create: null,

	element: function(slotId, element)
	{
		var elementSlot = this._metadata.elements[slotId];
		if(!elementSlot) {
			console.warn("(wabi.element.basic.element) Invalid slot id: " + slotId);
			return null;
		}

		if(!element) 
		{
			var prevElement = this.elements[slotId];
			if(prevElement) {
				prevElement.remove();
			}

			this.elements[slotId] = null;
			return null;
		}

		if(typeof element === "string")
		{
			element = wabi.createElement(element);
			if(!element) { 
				this.elements[slotId] = null;
				return null; 
			}
		}
		else if(!(element instanceof wabi.element.basic)) {
			console.warn("(wabi.element.basic.element) Invalid element passed should be string or extend `wabi.element.basic`");
			this.elements[slotId] = null;
			return null;
		}

		var params = elementSlot.params;
		for(var key in params) {
			element[key] = params[key];
		}

		element.flags |= (this.Flag.SLOT);
		element.slotId = slotId;
		this.elements[slotId] = element;

		var watch = elementSlot.watch;
		for(var key in watch) 
		{
			var funcName = watch[key];
			var func = this[funcName];
			if(!func) 
			{
				console.warn("(wabi.element.basic.element) Slot `" + slotId + "` watching on `" + 
					key + "` uses undefined function: " + funcName);
				continue;
			}

			element.watch(key, func, this);
		}

		var parentLink = this._metadata.elementsLinked[slotId];
		if(parentLink) {
			element._parentLink = parentLink;
			this._$[parentLink] = element;
		}

		var binds = this._metadata.elementsBinded[slotId];
		if(binds) {
			element.bind = binds;
		}	

		if(elementSlot.state) {
			element.$ = elementSlot.state;
		}

		var elementBefore = this.domElement.childNodes[elementSlot.slot];
		if(elementBefore) {
			this.appendBefore(element, elementBefore.holder);
		}
		else {
			element.appendTo(this);
		}

		return element;
	},	

	_setup: function()
	{
		// Create elements:
		var elements = this._metadata.elements;
		if(elements) 
		{
			if(!this.elements) {
				this.elements = {};
			}
			
			for(var key in elements) {
				this.element(key, elements[key].type);
			}
		}

		// Process initial state:
		if(this.flags & this.Flag.INITIAL_SETUP_DONE) 
		{
			var states = this._metadata.states;
			for(var key in states) {
				this._processState(key, states[key]);
			}
		}
		else 
		{
			var states = this._metadata.statesInitial;
			for(var key in states) {
				this._processState(key, states[key], true);
			}

			this.flags |= this.Flag.INITIAL_SETUP_DONE;
		}

		if(this.setup) {
			this.setup();
		}		
	},

	prepare: null,

	setup: null,

	append: function(element) {
		element.appendTo(this);
	},

	appendTo: function(parent)
	{
		if(!parent) {
			return console.warn("(wabi.element.basic.appendTo) Invalid parent passed");
		}

		if(this._parent) {
			return console.warn("(wabi.element.basic.appendTo) Element is already added to different parent");
		}

		var parentHolder;
		if(parent instanceof Element) 
		{
			parentHolder = parent.holder;
			if(!parentHolder) {
				parentHolder = wabi.createElement("wrapped", null, parent);
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

		if(parentHolder._data && parentHolder.bind !== "*") 
		{
			if(!this.region) { 
				this.data = parentHolder._data;
			}
		}
		
		if(parentHolder.domElement && (this.flags & this.Flag.ENABLED)) {
			parentHolder.domElement.appendChild(this.domElement);
		}
	},

	appendBefore: function(element, elementBefore)
	{
		if(!this.children) {
			return console.error("(wabi.element.")
		}
		else {
			this.children.push(element);
		}

		if(this._data && this.bind !== "*") 
		{
			if(!element.region) { 
				element.data = this._data;
			}
		}

		element._parent = this;

		if(this.flags & this.Flag.ENABLED) {
			this.domElement.insertBefore(element.domElement, elementBefore.domElement);
		}
	},

	_remove: function()
	{
		if(this.cleanup) {
			this.cleanup();
		}

		this.removeAll();

		if(this.flags & this.Flag.ENABLED) 
		{
			if(this._parent) {
				this._parent.domElement.removeChild(this.domElement);
			}
		}

		if(this._parent) 
		{
			var parentChildren = this._parent.children;
			var index = parentChildren.indexOf(this);
			if(index > -1) {
				parentChildren[index] = parentChildren[parentChildren.length - 1];
				parentChildren.pop();
			}

			if(this._parentLink) {
				this._parent._$[this._parentLink] = null;
				this._parentLink = null;
			}
			
			if(this.slotId) {
				this._parent.elements[this.slotId] = null;
				this.slotId = null;
			}

			if(this._parent.onChildRemove) {
				this._parent.onChildRemove(this);
			}
			
			this._parent = null;
		}

		if(this._data) {
			this.data = null;
		}

		if(this.domElement.className) {
			this.domElement.className = "";
		}
		
		while(this.domElement.attributes.length > 0) {
			this.domElement.removeAttribute(this.domElement.attributes[0].name);
		}

		this.flags = 0;
		this._bind = null;
		if(this._watching) { this._watching = null; }
		if(this.listeners) { this.listeners = null; }
		if(this.childrenListeners) { this.childrenListeners = null; }
	},

	removeAll: function()
	{
		if(this.children) 
		{
			for(var n = this.children.length - 1; n > -1; n--) {
				wabi.removeElement(this.children[n]);
			}
		}
	},

	remove: function() {
		wabi.removeElement(this);
	},

	removeChildWithData: function(data) 
	{
		if(!this.children) { return; }

		for(var n = 0; n < this.children.length; n++) {
			var child = this.children[n];
			if(child.data === data) {
				child.remove();
			}
		}
	},

	onChildRemove: null,

	attrib: function(key, value)
	{
		if(value === void(0)) {
			return this.domElement.getAttribute(key);
		}
		else {
			this.domElement.setAttribute(key, value);
		}
		
		return value;
	},

	removeAttrib: function(key) {
		this.domElement.removeAttribute(key);
	},

	style: function(key, value)
	{
		if(this.domElement.style[key] === void(0)) {
			console.warn("(wabi.element.basic.style) Invalid DOM style:", key);
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

	removeStyle: function(key) {
		this.domElement.style.removeProperty(key);
	},

	setCls: function(name, state) 
	{
		if(state) {
			this.domElement.classList.add(name);
		}
		else {
			this.domElement.classList.remove(name);
		}
	},

	get: function(id) 
	{
		if(id[0] === "#")
		{
			var domElement = this.domElement.querySelector(id);
			if(domElement) {
				return domElement.holder;
			}
		}
		else
		{
			if(typeof id === "function")
			{
				var tag = id.prototype.tag || id.prototype._metadata.name;

				var buffer = this.domElement.querySelectorAll(tag);
				var num = buffer.length;
				if(num > 0) 
				{
					var holderBuffer = new Array(num);
					for(var n = 0; n < num; n++) 
					{
						if(buffer[n].holder instanceof id) {
							holderBuffer[n] = buffer[n].holder;
						}
					}

					return holderBuffer;
				}
			}
			else
			{
				var buffer = this.domElement.querySelectorAll(id);
				var num = buffer.length;
				if(num > 0) 
				{
					var holderBuffer = new Array(num);
					for(var n = 0; n < num; n++) {
						holderBuffer[n] = buffer[n].holder;
					}

					return holderBuffer;
				}
			}
		}

		return null;
	},

	on: function(event, id, cb, owner)
	{
		if(id === undefined) {
			console.warn("(wabi.element.basic.on) Invalid callback passed to event: " + event);
			return;
		}

		if(typeof(id) === "function") {
			owner = cb;
			cb = id;
			id = null;
		}

		if(!cb) {
			console.warn("(wabi.element.basic.on) Invalid callback function: " + event);
			return;
		}

		var element, listeners;

		if(id)
		{
			if(typeof(id) === "string" && id[0] === "#")
			{
				element = this.get(id);
				if(!element) { return; }
			}
			else
			{
				if(!this.childrenListeners) {
					this.childrenListeners = {};
				}

				if(id instanceof Array) 
				{
					for(var n = 0; n < id.length; n++) {
						this._onChildListen(event, id[n], cb, owner);
					}
				}
				else {
					this._onChildListen(event, id, cb, owner)
				}

				return;
			}	
		}
		else
		{
			element = this;	
		}

		listeners = element.listeners;
		if(!listeners) {
			listeners = {};
			element.listeners = listeners;
		}

		var buffer = listeners[event];
		if(!buffer) {
			buffer = [];
			listeners[event] = buffer;
			element._addEvent(event);
		}

		buffer.push(cb.bind(owner));			
	},

	emit: function(eventName, domEvent)
	{
		var event;

		if(this.listeners)
		{
			var buffer = this.listeners[eventName];
			if(buffer)
			{
				event = new wabi.event(eventName, this, domEvent);
				if(this._preventableEvents[eventName]) {
					domEvent.preventDefault();
				}

				for(var n = 0; n < buffer.length; n++) {
					buffer[n](event);
				}
			}
		}

		// if(this._parent) 
		// {
		// 	if(!event) 
		// 	{
		// 		event = new wabi.event(eventName, this, domEvent);
		// 		if(this._$preventableEvents[eventName]) {
		// 			domEvent.preventDefault();
		// 		}
		// 	}

		// 	this.checkParentListeners(eventName, event);
		// }
	},

	emitEx: function(event)
	{
		if(!this.listeners) { return; }

		var buffer = this.listeners[event.name];
		if(!buffer) { return; }

		for(var n = 0; n < buffer.length; n++) {
			buffer[n](event);
		}
	},

	checkParentListeners: function(eventName, event)
	{
		var buffer = this.childrenListeners[eventName];
		if(buffer)
		{
			for(var n = 0; n < buffer.length; n++) {
				buffer[n](event);
			}
		}

		if(this._parent) {
			this.checkParentListeners(eventName, event);
		}
	},

	_onChildListen: function(event, id, cb, owner)
	{
		var map = this.childrenListeners[id];
		if(!map) {
			map = {};
			this.childrenListeners[id] = map;
		}

		var buffer = map[event];
		if(!buffer) {
			buffer = [ cb.bind(owner) ];
			map[event] = buffer;
		}
		else {
			buffer.push(cb.bind(owner));
		}

		if(this.domElement["on" + event] === null) {
			this._addEvent(event);
		}
	},

	off: function(event, owner)
	{

	},

	set id(id) 
	{
		if(id) {
			this.domElement.id = id;
		}
		else {
			this.domElement.removeAttribute("id");
		}
	},

	get id() {
		return this._id;
	},

	set bind(bind)
	{
		if(bind)
		{
			var element;
			var statesLinked = this._metadata.statesLinked;

			if(typeof(bind) === "string") 
			{
				var element = statesLinked.value;
				if(element !== undefined)
				{
					element = this.elements[element];
					if(element) {
						element.bind = bind;
						bind = null;
					}					
				}
			}
			else 
			{
				for(var key in bind)
				{
					var elementLinked = statesLinked[key];
					if(elementLinked !== undefined) 
					{
						var element = this.elements[elementLinked];
						if(element) {
							element.bind = bind[key];
							delete bind[key];
						}
					}
				}
			}
		}

		this._bind = bind;
		this.updateBindings();
	},

	get bind() {
		return this._bind;
	},

	set hidden(value)
	{
		if(value) 
		{
			if(this.flags & this.Flag.HIDDEN) { return; }
			this.flags |= this.Flag.HIDDEN;

			this.domElement.classList.add("hidden");
		}
		else 
		{
			if((this.flags & this.Flag.HIDDEN) === 0) { return; }
			this.flags &= ~this.Flag.HIDDEN;

			this.domElement.classList.remove("hidden");
		}
	},

	get hidden() {
		return ((this.flags & this.Flag.HIDDEN) === this.Flag.HIDDEN);
	},

	set enabled(value)
	{
		if(value) 
		{
			if(this.flags & this.Flag.ENABLED) { return; }
			this.flags |= this.Flag.ENABLED;

			if(this._parent) {
				this._parent.domElement.appendChild(this.domElement);
			}
		}
		else 
		{
			if((this.flags & this.Flag.ENABLED) === 0) { return; }
			this.flags &= ~this.Flag.ENABLED;

			if(this._parent) {
				this._parent.domElement.removeChild(this.domElement);
			}
		}
	},

	get enabled() {
		return ((this.flags & this.Flag.ENABLED) === this.Flag.ENABLED);
	},

	set $(state)
	{
		if(typeof(state) === "object")
		{
			for(var key in state) {
				this.setState(key, state[key]);
			}
		}
		else {
			this.setState("value", state);
		}
	},

	get $() {
		return this._$;
	},

	set parent(parent)
	{	
		if(this._parent === parent) { return; }

		if(parent) {
			this.appendTo(parent);
		}
		else 
		{
			if(this._parent) {
				this._parent.remove(this);
			}
		}
	},

	get parent() {
		return this._parent;
	},

	set data(data)
	{
		if(data instanceof wabi.ref)
		{
			if(this._data === data.instance) { return; }

			if(this._data && this.flags & this.Flag.WATCHING) 
			{
				this.flags &= ~this.Flag.WATCHING;
				this._data.unwatch(this.handleDataChange, this);
			}

			this._data = data.instance;
			this.ref = data;
		}
		else 
		{
			if(this._data === data) { return; }

			if(this._data && this.flags & this.Flag.WATCHING) 
			{
				this.flags &= ~this.Flag.WATCHING;
				this._data.unwatch(this.handleDataChange, this);
			}

			this._data = data;
		}

		this.updateBindings();
		
		if(this.children)
		{
			for(var n = 0; n < this.children.length; n++) 
			{
				var child = this.children[n];
				if(child.region) { continue; }

				child.data = data;
			}
		}
	},

	get data() {
		return this._data;
	},

	html: function(value) 
	{
		if(value === undefined) {
			return this.domElement.innerHTML;
		}

		if(this.children && this.children.length > 0) {
			console.warn("(wabi.element.basic.html) Can`t set html content for element `" + this._metadata.name + "` that has children");
			return null;
		}

		this.domElement.innerHTML = value
		return value;
	},

	updateBindings: function()
	{
		if(this._data)
		{
			if(this._bind)
			{
				if((this.flags & this.Flag.WATCHING) === 0) {
					this.flags |= this.Flag.WATCHING;
					this._data.watch(this.handleDataChange, this);
				}
				
				if(typeof(this._bind) === "string") {
					this.updateDataValue("value", this._bind);
				}
				else
				{
					for(var key in this._bind) {
						this.updateDataValue(key, this._bind[key]);
					}
				}
			}
			else
			{
				if(this._data && this.flags & this.Flag.WATCHING) {
					this.flags &= ~this.Flag.WATCHING;
					this._data.unwatch(this.handleDataChange, this);
				}				
			}
		}
	},

	updateDataValue: function(key, bind)
	{
		var value = this._data.get(bind);
		if(value !== undefined) {
			this.setState(key, value);
		}
		else {
			// this.setState(key, (this._$.value !== undefined) ? this._$.value : null);
		}		
	},

	_addEvent: function(eventName) 
	{
		var func = this["handle_" + eventName];

		if(eventName === "click") 
		{
			this.domElement.onclick = this._processClick.bind(this);
			if(func) {
				this._onClick = func.bind(this);
			}
		}
		else if(eventName === "dblclick") 
		{
			this.domElement.onclick = this._processClicking.bind(this);
			if(func) {
				this._onDblClick = func.bind(this);
			}
		}
		else 
		{
			var eventKey = "on" + eventName;

			if(this.domElement[eventKey] === null) 
			{
				var self = this;
				this.domElement[eventKey] = function(domEvent) {
					self._processEvent(eventName, func, domEvent);
				}
			}
		}
	},

	_onClick: null,

	_onDblClick: null,

	_processClick: function(domEvent)
	{
		var event = new wabi.event("click", this, domEvent);

		var element = domEvent.target.holder;
		if(element && element !== this) 
		{
			this._processChildEvent(element._metadata.name, event);
			this._processChildEvent("*", event);
		}

		if(this._onClick) {
			this._onClick(event);
		}

		this.emitEx(event);
	},

	_processClicking: function(domEvent)
	{
		var event;
		if(domEvent.detail % 2 === 0) {
			event = new wabi.event("dblclick", this, domEvent);
		}
		else {
			event = new wabi.event("click", this, domEvent);
		}

		var element = domEvent.target.holder;
		if(element !== this) 
		{
			event.element = element;

			this._processChildEvent(element._metadata.name, event);
			this._processChildEvent("*", event);
			return;
		}

		if(domEvent.detail % 2 === 0) 
		{
			if(this._onDblClick) {
				this._onDblClick(event);
			}

			this.emitEx(event);
		}
		else 
		{
			if(this._onClick) {
				this._onClick(event);
			}

			this.emitEx(event);
		}
	},

	_processEvent: function(eventName, func, domEvent)
	{
		var event = new wabi.event(eventName, this, domEvent);
		if(this._preventableEvents[eventName]) {
			domEvent.preventDefault();
			domEvent.stopPropagation();
		}		

		var element = domEvent.target.holder;
		if(element !== this) 
		{
			event.element = element;

			this._processChildEvent(element._metadata.name, event);
			this._processChildEvent("*", event);
			return;
		}

		if(func) {
			func.call(this, event);
		}
		
		this.emitEx(event);		
	},

	_processChildEvent: function(id, event)
	{
		if(!this.childrenListeners) { return; }

		var map = this.childrenListeners[id];
		if(!map) { return; }

		var buffer = map[event.name];
		if(buffer)
		{
			for(var n = 0; n < buffer.length; n++) {
				buffer[n](event);
			}

			return;
		}		
	},

	handleDataChange: function(action, key, value, id)
	{
		var bind = this._bind;
		var type = typeof(bind);

		if(type === "string") 
		{
			if(key !== bind && bind !== "*") { return; }

			this._setActionState(action, "value", value, id);
		}
		else if(type === "object")
		{
			if(bind[key] === void(0)) { return; }

			this._setActionState(action, bind[key], value, id);
		}
	},

	_updateParentStateFunc: function(key, value)
	{
		if(this._parentLink && key === "value") {
			value = this._parent._updateParentStateFunc(this._parentLink, value);
		}

		const func = this["set_" + key];
		if(func) 
		{
			const haveDepsHandled = this.deps[key];
			if(!haveDepsHandled) 
			{
				let deps = this.depStates;
				if(!deps) {
					deps = {};
					this.depStates = deps;
				}

				this.deps[key] = true;
				wabi.pushDependency(key, deps);
			}

			const newValue = func.call(this, value);
			if(newValue !== undefined) {
				value = newValue;
			}

			if(!haveDepsHandled) {
				wabi.popDependency();
			}
		}

		if(this.watching)
		{
			const func = this.watching[key];
			if(func) {
				func.call(this._parent, value);
			}
		}

		return value;
	},

	_updateState: function(key, value)
	{
		if(this._parentLink && key === "value") {
			value = this._parent._updateParentStateFunc(this._parentLink, value);
		}

		if(this._data && this._bind) 
		{
			if(typeof(this._bind) === "string")
			{
				if(key === "value") {
					this._data.set(this._bind, value);
				}
				else {
					this._setActionState("set", key, value);
				}
			}
			else
			{
				var dataBindName = this._bind[key];
				if(dataBindName) {
					data.set(dataBindName, value);
				}
				else {
					this._setActionState("set", dataBindName, value);
				}
			}
		}
		else 
		{
			this._setActionState("set", key, value);
		}
	},

	_setActionState: function(action, key, value, index)
	{
		if(this._$[key] === undefined) { return; }

		var func = this[action + "_" + key];
		if(func) 
		{
			var newValue = func.call(this, value);
			if(newValue !== undefined) {
				value = newValue;
			}
		}

		if(this.watching)
		{
			var func = this.watching[key];
			if(func) {
				func.call(this._parent, value);
			}
		}

		if(action === "set") {
			this._$[key] = value;
		}

		const dep = this.depStates[key];
		if(dep)
		{
			for(let n = 0; n < dep.length; n++) {
				let depsKey = dep[n];
				this._updateState(depsKey, this.$[depsKey]);
			}
		}
	},

	setState: function(key, value)
	{
		var stateValue = this._$[key];
		if(stateValue === undefined) { return; }

		if(this._parentLink && key === "value") {
			value = this._parent.setStateParent(this._parentLink, value);
		}

		var func = this["set_" + key];
		if(func) 
		{
			var newValue = func.call(this, value);
			if(newValue !== undefined) {
				value = newValue;
			}
		}

		if(stateValue instanceof wabi.element.basic) {
			stateValue.setState("value", value);
		}
		else 
		{
			if(this.watching)
			{
				var func = this.watching[key];
				if(func) 
				{
					var newValue = func.call(this._parent, value);
					if(newValue !== undefined) {
						value = newValue;
					}
				}
			}

			this._$[key] = value;
		}
	},

	setStateParent: function(key, value)
	{
		if(this._parentLink && key === "value") {
			value = this._parent.setStateParent(this._parentLink, value);
		}

		var func = this["set_" + key];
		if(func) {
			func.call(this, value);
		}
		
		return value;
	},

	_processState: function(key, value, initial)
	{
		if(value === undefined) { return; }

		if(!initial && this._$[key] === value) { return; }

		var func = this["set_" + key];
		if(func) 
		{
			const haveDepsHandled = this.deps[key];
			if(!haveDepsHandled) 
			{
				let deps = this.depStates;
				if(!deps) {
					deps = {};
					this.depStates = deps;
				}

				this.deps[key] = true;
				wabi.pushDependency(key, deps);
			}

			var newValue = func.call(this, value);
			if(newValue !== undefined) {
				value = newValue;
			}

			if(!haveDepsHandled) {
				wabi.popDependency();
			}
		}

		var elementKey = this._metadata.statesLinked[key];
		if(elementKey) {
			return this.elements[elementKey]._processState("value", value);
		}
		else 
		{
			if(this.watching)
			{
				var func = this.watching[key];
				if(func) {
					func.call(this._parent, value);
				}
			}

			this._$[key] = value;
		}

		return value;
	},

	watch: function(name, func)
	{
		if(!this.watching) {
			this.watching = {};
		}

		this.watching[name] = func;
	},

	unwatch: function(name, func)
	{
		if(this.watching[name]) {
			this.watching[name] = null;
		}
	},

	toJSON: function() {
		return this._$;
	},

	Flag: {
		NONE: 0,
		ENABLED: 1 << 1,
		WATCHING: 1 << 2,
		ELEMENT: 1 << 3,
		SLOT: 1 << 4,
		HIDDEN: 1 << 5,
		INITIAL_SETUP_DONE: 1 << 6
	},

	//
	_metadata: null,
	elements: null,
	domElement: null,

	_id: "",
	_$: null,
	_parent: null,
	_data: null,
	_bind: null,
	ref: null,
	_parentLink: null,

	slotId: null,

	watchers: null,
	watching: null,

	flags: 0,
	tag: null,

	listeners: null,
	children: null,
	childrenListeners: null,
	_preventableEvents: {
		"contextmenu": true
	},
	
	region: false
});

Element.prototype.holder = null;

"use strict";

wabi.element("button",
{
	set_value: function(value) {
		this.html(value);
	},

	set_width: function(value) 
	{
		if(value > 0) {
			this.style("flex", "1 1 " + value + "px");
		}
		else if(this.style("flex")) {
			this.style("flex", "");
		}
	},

	//
	width: 0
});

"use strict";

wabi.element("canvas", 
{
	prepare: function() {
		this.ctx = this.domElement.getContext("2d");
	},

	//
	ctx: null
});
"use strict";

wabi.element("caret", 
{
	state: {
		value: true
	},

	setup: function() {
		this.setCls("fa", true);
	},

	toggle: function() {
		this.$value = !this.$value;
	},

	set_value: function(value)
	{
		if(value) {
			this.setCls("fa-caret-right", false);
			this.setCls("fa-caret-down", true);
		}
		else {
			this.setCls("fa-caret-down", false);
			this.setCls("fa-caret-right", true);
		}
	},

	handle_click: function(event) {
		this.toggle();
	}
});

"use strict";

wabi.element("checkbox", 
{
	state: {
		value: false
	},

	setup: function() {
		this.attrib("tabindex", "0");
	},

	set_value: function(value) {
		this.setCls("active", value);
	},

	handle_click: function() {
		this.toggle();
	},

	handle_keydown: function(event) 
	{
		if(event.domEvent.keyCode === 32) {
			this.toggle();
		}
	},

	toggle: function() {
		this.$value = !this.$value;
	}
});

"use strict";

wabi.element("content", 
{
	set_value: function(value) 
	{
		this.removeAll();

		this.$loadValue(value);
	},

	$loadValue: function(value)
	{
		if(!value) { return; }

		var type = typeof(value);
		
		if(type === "object")
		{
			if(value instanceof Array)
			{
				for(var n = 0; n < value.length; n++)
				{
					var state = value[n];
					if(typeof(state) === "string") 
					{
						var template = wabi.getFragment(state);
						this.$loadValue(template);
					}
					else {
						this.$loadState(state);
					}
				}	
			}
			else {
				this.$loadState(value);
			}
		}
		else 
		{
			var template = wabi.getFragment(value);
			this.$loadValue(template);
		}		
	},

	$loadState: function(state)
	{
		if(!state.type) {
			console.warn("(wabi.elements.content) Undefined element type");
			return;
		}

		var element = wabi.createElement(state.type, this);
		if(!element) { return; }

		for(var key in state)
		{
			if(key === "type") { continue; }

			element[key] = state[key];
		}
	},

	set padding(value) 
	{
		if(value > 0) {
			this.style("margin", value + "px");
		}
		else if(this.style("margin")) {
			this.style("margin", "");
		}
	},

	get padding() {
		return this._padding;
	},

	set height(value) 
	{
		this.style("height", value + "px");
	},

	get height() {
		return this._height;
	},

	//
	_padding: 0,
	_height: 0	
});
"use strict";

wabi.element("desc",
{
	elements: 
	{
		content: {
			type: "content",
			link: "value"
		},
		name: {
			type: "text",
			link: "name"
		}
	}
});


"use strict";

wabi.element("div", {});
"use strict";

wabi.element("dropdown",
{
	state: 
	{
		value: "",
		dataset: null,
		filter: null,
		sort: false,
		emptyOption: false		
	},

	elements: 
	{
		input: {
			type: "staticInput",
			bind: "value",
			region: true
		},
		caret: {
			type: "icon",
			$value: "fa-caret-down"
		},
		list: "list"
	},

	setup: function()
	{
		this.elements.list.on("click", this.selectOption, this);
		
		this.on("click", "staticInput", this.openMenu, this);
		wabi.on("click", this.hideMenu, this);
	},

	cleanup: function()
	{
		wabi.off("click", this.hideMenu, this);
	},

	set_value: function(value)
	{
		if(this._dataset)
		{
			var data = this._dataset.get(value);
			if(!data) {
				this.elements.input.data = null;
				this.elements.input.$value = "";
				return "";
			}

			this.elements.input.data = data;
		}
		else {
			this.elements.input.data = null;
			this.elements.input.$value = "";
			return "";
		}
	},

	set_dataset: function(value)
	{
		if(!value) {
			this._dataset = null;
			return;
		}

		this._dataset = wabi.globalData.get(value);
		if(!this._dataset) {
			console.log("(wabi.element.dropdown.set_dataset) Data set not found: " + value);
			return;
		}
	},

	openMenu: function(event)
	{
		event.stop();

		var list = this.elements.list;
		list.removeAll();

		if(!this._dataset) { return; }

		list.$value = this.genDataBuffer();
		list.hidden = false;
	},

	genDataBuffer: function()
	{
		var buffer = {};
		var data = new wabi.data(buffer);
		var raw = this._dataset.raw;

		if(this.$emptyOption) {
			buffer[""] = { value: "" };
		}

		for(var key in raw) {
			buffer[key] = raw[key];
		}

		return data;
	},

	hideMenu: function(event) {
		this.elements.list.hidden = true;
	},

	selectOption: function(event)
	{
		event.stop();

		this.$value = this.elements.list.cache.selected.data.id;
		this.hideMenu();
	},

	//
	_dataset: null,
});

"use strict";

wabi.element("error", 
{
	state: {
		types: {}
	},

	set_value: function(value)
	{
		if(!value) {
			this.html("");
			return;
		}

		var text = this.$types[value];
		if(!text) {
			this.html("");
			return; 
		}

		this.html(text);
	},

	set_types: function(value)
	{
		if(this.$value) {
			this.set_value(this.$value);
		}
	}
});

"use strict";

wabi.element("group", 
{
	params: {
		padding: 2
	},

	set_value: function(value) 
	{

	},

	set_padding: function(value) {
		this.style("margin", value + "px");
	}
})
"use strict";

wabi.element("header", 
{
	set_value: function(value) {
		this.html(value);
	}
});

"use strict";

wabi.element("headerEx",
{
	elements: 
	{
		caret: {
			type: "caret",
			link: "open"
		},
		text: {
			type: "text",
			link: "value"
		}
	},

	prepare: function() {
		this.on("click", "*", this.handle_click, this);
	},

	handle_click: function(event) {
		this.elements.caret.toggle();
	},

	//
	tag: "header"
});

"use strict";

wabi.element("html", 
{
	set_value: function(value)
	{
		// TODO: parse by tokens
		this.domElement.innerHTML = value;

		var iter = document.createNodeIterator(this.domElement, NodeFilter.SHOW_TEXT);
		var currNode, text, name, firstIndex, lastIndex;
		while(currNode = iter.nextNode()) 
		{
			text = currNode.nodeValue; 

			firstIndex = text.indexOf("{");
			if(firstIndex === -1) { continue; }

			lastIndex = text.indexOf("}");
			if(lastIndex === -1) { continue; }

			name = text.slice(firstIndex + 1, lastIndex);
			this.genStateFuncs(name);
		}
	},

	// genStateFuncs_HTML: function(name, element) 
	// {
	// 	var self = this;

	// 	if(this._stateValues[name]) {
	// 		element.innerHTML = this._stateValues[name];
	// 	}
	// 	else {
	// 		element.innerHTML = "";
	// 	}

	// 	Object.defineProperty(this._state, name, {
	// 		set: function(value) 
	// 		{
	// 			if(self._stateValues[name] === value) { return; }
	// 			self._stateValues[name] = value;

	// 			if(self._data && self._bind && self._bind[name]) {
	// 				self._data
	// 			}

	// 			element.innerHTML = value;
	// 		},
	// 		get: function() {
	// 			return self._stateValues[name];
	// 		},
	// 		enumerable: true,
	// 		configurable: true
	// 	});		
	// },		
});

"use strict";

wabi.element("icon", 
{
	setup: function() 
	{
		this.hidden = true;
		this.attrib("class", "fa");
	},

	set_value: function(value, prevValue) 
	{
		this.setCls(value, true);
		this.hidden = false;
	}
});
"use strict";

wabi.element("iframe",
{
	// $addEvent: function(eventName) 
	// {
	// 	var func = this.$wnd["handle_" + eventName];

	// 	if(eventName === "click") 
	// 	{
	// 		this.$domElement.onclick = this.$processClick.bind(this);
	// 		if(func) {
	// 			this.$onClick = func.bind(this);
	// 		}
	// 	}
	// 	else if(eventName === "dblclick") 
	// 	{
	// 		this.$domElement.onclick = this.$processClicking.bind(this);
	// 		if(func) {
	// 			this.$onDblClick = func.bind(this);
	// 		}
	// 	}
	// 	else 
	// 	{
	// 		var eventKey = "on" + eventName;

	// 		if(this.$domElement[eventKey] === null) 
	// 		{
	// 			var self = this;
	// 			this.$domElement[eventKey] = function(domEvent) {
	// 				self.$processEvent(eventName, func, domEvent);
	// 			}
	// 		}
	// 	}
	// },

	set_value: function(value) {
		this.domElement.src = value;
	},

	handle_load: function(event) {
		this.wnd = this.domElement.contentWindow;
	},

	//
	wnd: null
});

"use strict";

wabi.element("input", 
{
	set_value: function(value) {
		this.domElement.value = value;
	},

	set inputType(value) {
		this.attrib("type", value);
	},

	get inputType() {
		return this.attrib("type");
	},

	set placeholder(value) 
	{
		if(value) {
			this.domElement.placeholder = value;
		}
		else {
			this.domElement.placeholder = "";
		}
	},

	get placeholder() {
		return this.domElement.placeholder;
	},

	set readOnly(value) {
		this.domElement.readOnly = value;
	},

	get readOnly() {
		return this.domElement.readOnly;
	},

	set editable(value) 
	{
		if(value) {
			this.removeAttrib("readonly");
		}
		else {
			this.attrib("readonly", "");
		}
	},

	get editable() {
		return (this.attrib("readonly") === undefined);
	},

	handle_change: function(event) {
		this.$value = this.domElement.value;
	},

	//
	tag: "input"
});

wabi.element("staticInput", "input",
{
	setup: function() {
		this.editable = false;
	}
});

"use strict";

wabi.element("label",
{
	elements: 
	{
		name: {
			type: "text",
			link: "name"
		},
		content: {
			type: "content",
			link: "value"
		}
	}
});

"use strict";

wabi.element("list",
{
	setup: function()
	{
		this.cache = {
			itemElements: [],
			selectable: true,
			selected: null, 
			dragging: null
		};
	},

	set_value: function(value) 
	{
		this.removeAll();

		if(value) 
		{
			this.set_placeholder(null);

			if(value instanceof Object)
			{
				if(value instanceof Array)
				{
					for(var n = 0; n < value.length; n++) {
						this.add_value(value.get(n));
					}
				}
				else
				{
					var raw = value.raw;
					for(var key in raw) {
						this.add_value(value.get(key));
					}
				}
			}
		}

		if(!this.children || this.children.length === 0) {
			this.set_placeholder(this.placeholder);
		}	
	},

	add_value: function(data)
	{
		this.set_placeholder(null);

		var element = wabi.createElement("listItemHolder", this);
		element.$item = this.itemCls;
		element.data = data;
	},

	remove_value: function(value)
	{
		if(!this.children) { return; }

		for(var n = 0; n < this.children.length; n++) 
		{
			var child = this.children[n];
			if(child.data === value) {
				this.remove(child);
				return;
			}
		}
	},

	set_placeholder: function(value)
	{
		if(value)
		{
			if(!this.domElement.innerHTML) {
				this.setCls("empty", true);
				this.html(value);
			}
		}
		else
		{
			this.setCls("empty", false);

			if(!this.children || this.children.length === 0) {
				this.html("")
			}
		}
	},

	set_itemCls: function(itemCls)
	{
		if(!itemCls) {
			return "listItem";
		}

		var cls = wabi.element[itemCls];
		if(!cls) {
			console.warn("(wabi.elements.list.set_itemCls) No such element found: " + itemCls);
			return "listItem";
		}
	},

	createFolder: function()
	{
		var element = wabi.createElement("listItem", this);
		element.value = "Folder";
		element.folder = true;
	},

	set select(element)
	{
		if(!this.cache.selectable) { return; }

		element.select = true;
	},

	get select() {
		return this.cache.selected;
	},

	set selectable(value)
	{
		if(this.cache.selectable === value) { return; }
		this.cache.selectable = value;

		if(!value && this.cache.selected) {
			this.cache.selected = false;
		}
	},

	get selectable() {
		return this.cache.selectable;
	},

	//
	cache: null,

	itemCls: "listItem"
});

wabi.element("listItemHolder", 
{
	elements: 
	{
		item: {
			type: null,
			watch_open: "handleItemOpen"
		},
		list: {
			type: "list",
			bind: "content",
			link: "content"
		}
	},

	setup: function() {
		this.attrib("draggable", "true");
		// this.elements.list.cache = this.parent.cache;
	},

	set_item: function(cls)
	{
		this.elements.list.itemCls = cls;
		this.element("item", cls);
	},

	set_content: function(value)
	{
		console.log("set_content", value)
		this.elements.item.$folder = value ? true : false;
		// if(this.itemElement) {
		// 	this.itemElement.folder = value ? true : false;
		// }
	},

	add_content: function(value) 
	{
		console.log("add_content", value)
	},

	updateOpen: function(event) {
		this.elements.list.hidden = !this.itemElement.open;
	},

	handleItemOpen: function(value) {
		this.elements.list.hidden = !value;
	},

	// handle_click: function(event) {

	// 	this.elements.item.select = true;
	// },

	// handle_dblclick: function(event) 
	// {
	// 	if(this.elements.item.$folder) {
	// 		this.elements.item.$open = !this.elements.item.$open;
	// 	}
	// },

	handle_dragstart: function(event) 
	{
		this.setCls("dragging", true);
		// this.cache.dragging = this;
		
		if(this.elements.item.$folder) {
			this.elements.item.$open = false;
		}

		event.domEvent.dataTransfer.effectAllowed = "move";
	},

	handle_dragend: function(event) 
	{
		this.setCls("dragging", false)
	},

	handle_dragenter: function(event) 
	{
		// if(event.element === this) { return; }

		this.setCls("dragover", true);
	},

	handle_dragleave: function(event) 
	{
		// if(event.element === this) { return; }

		this.setCls("dragover", false);
	},

	// handle_dragover: function(event)
	// {
	// 	// if(event.element === this) { return; }

	// 	// var bounds = this.domElement.getBoundingClientRect();
	// 	// // console.log(bounds);
	// 	// // console.log("cursor", event.x, event.y)

	// 	// if((bounds.top + 5) <= event.y) {
	// 	// 	console.log("drag-top");
	// 	// 	return;
	// 	// }
	// 	// else if((bounds.bottom - 5) >= event.y) {
	// 	// 	console.log("drag-bottom")
	// 	// 	return;
	// 	// }

	// 	// event.stop();
	// 	// event.domEvent.dataTransfer.dropEffect = "move";
	// },

	// handle_drop: function(event) 
	// {
	// 	// if(event.element === this) { return; }

	// 	// this.setCls("dragover", false);
	// 	// this.folder = true;

	// 	// var cacheData = this.cache.dragging.data;
	// 	// this.data.push("content", cacheData);

	// 	// event.stop();
	// },	

	// handle_mouseenter: function(event) {
	// 	event.stop();
	// 	event.domEvent.stopPropagation()
	// 	console.log("enter", this.elements.item.$value);
	// 	this.elements.item.setCls("hover", true)
	// },

	// handle_mouseleave: function(event) {
	// 	event.stop();
	// 	event.domEvent.stopPropagation()
	// 	console.log("leave", this.elements.item.$value)
	// 	this.elements.item.setCls("hover", false);
	// },

	//
	tag: "holder",
	itemElement: null,
	draggable: false,
	region: true
});

wabi.element("listItem",
{
	elements: 
	{
		folder: null,
		word: {
			type: "text",
			link: "value",
			bind: "value"
		}
	},

	setup: function() 
	{
		this.attrib("tabindex", "0");

		this.on("click", "*", function() {
			this.select = true;
		}, this);

		this.editable = false;
	},

	cleanup: function() 
	{
		if(this.cache.selected === this) {
			this.cache.selected = null;
		}
	},

	set select(value)
	{
		if(value)
		{
			if(this.cache.selected) {
				this.cache.selected.select = false;
			}

			this.cache.selected = this;
		}
		else
		{
			if(this.cache.selected !== this) { 
				this.cache.selected = null;
			}
		}

		this.setCls("selected", value);
	},

	get select() {
		return (this === this.cache.selected);
	},

	set_folder: function(value) 
	{
		this.slot("folder", value ? "caret" : null);

		if(value) {
			this.open = false;
		}
	},

	handle_click: function(event) {
		this.select = true;
	},

	handle_dblclick: function(event)
	{
		if(this.folder) {
			this.open = !this.open;
		}
	},

	get cache() {
		return this.parent.parent.cache;
	},

	//
	tag: "item"
});

wabi.element("editableListItem", "listItem",
{
	elements: 
	{
		folder: null,
		word: {
			type: "word",
			link: "value",
			bind: "value"
		}
	}
});

"use strict";

wabi.element("loader", 
{
	setup: function() {
		this.hidden = true;
	}
});

"use strict";

wabi.element("menubar",
{
	elements: 
	{
		left: {
			type: "content",
			link: "value"
		},
		center: {
			type: "content",
			link: "center"
		},
		right: {
			type: "content",
			link: "right"
		}
	},

	setup: function()
	{
		this.elements.left.setCls("left", true);
		this.elements.center.setCls("center", true);
		this.elements.right.setCls("right", true);
	}
});

"use strict";

wabi.element("number", 
{
	state: {
		value: 0,
		min: Number.MIN_SAFE_INTEGER,
		max: Number.MAX_SAFE_INTEGER			
	},

	prepare: function() {
		this.attrib("type", "text");
	},

	set_value: function(value)
	{
		if(isNaN(value)) {
			// value = "0";
			//value = 0;
			console.log("num", value)
		}
		else
		{
			if(value < this.min) {
				value = this.min;
			}
			if(value > this.max) {
				value = this.max;
			}
		}

		this.domElement.value = value + "";

		return value;
	},

	set_min: function(value) {
		this.$value = this.$value;
	},

	set_max: function(value) {
		this.$value = this.$value;
	},

	handle_keydown: function(event)
	{
		var domEvent = event.domEvent;

		if(domEvent.ctrlKey) { return; }

		var keyCode = domEvent.keyCode;

		// If arrows:
		if(keyCode >= 37 && keyCode <= 40) {
			return;
		}

		// If numpad:
		if(keyCode >= 96 && keyCode <= 105) {
			keyCode -= 48;
		}

		var value = domEvent.target.value;

		switch(keyCode)
		{
			case 8: // Backspace
			case 46: // Delete
				return;

			case 27: // Esc
				domEvent.target.value = this._value;
				return;

			case 187: // +
			case 189: // -
			{
				if(domEvent.target.selectionStart !== 0 && value.length !== 0) {
					domEvent.preventDefault();
				}
			} return;

			case 190: // "."
			{
				var firstIndex = value.indexOf(".");
				if(firstIndex !== -1) {
					domEvent.preventDefault();
				}
			} return;
		}

		var key = String.fromCharCode(keyCode)
		if(isNaN(key)) {
			domEvent.preventDefault();
		}
	},

	handle_change: function(event) {
		this.$value = parseFloat(this.domElement.value);
	},

	//
	tag: "input"
});

"use strict";

wabi.element("panel", 
{
	state: {
		header: "Panel"
	},

	elements: 
	{
		header: { 
			type: "header",
			link: "header"
		},
		content: {
			type: "content",
			link: "value"
		}
	},

	set width(width) 
	{
		this.style("width", width + "px");
	},

	get width() {
		return this._width;
	},

	set height(height) 
	{
		this.style("min-height", height + "px");		
	},

	get height() {
		return this._height;
	},

	//
	_width: 0,
	_height: 0
});

"use strict";

wabi.element("row", 
{
	set_value: function(value) 
	{
		this.removeAll();
		
		if(!value) { return; }

		for(var n = 0; n < value.length; n++)
		{
			var elementCfg = value[n];

			var element = wabi.createElement(elementCfg.type, this);
			if(!element) {
				continue;
			}

			for(var key in elementCfg) 
			{
				if(key === "type") { continue; }

				element[key] = elementCfg[key];
			}
		}	
	}
});

"use strict";

wabi.element("span", {});

"use strict";

wabi.element("tag",
{
	set_value: function(value)
	{
		console.log("tag", value)

		if(!value) {
			this.html("");
		}
		else {
			this.html(value);
		}
	}
});

"use strict";

wabi.element("template", 
{
	process_value: function(value)
	{
		this.removeAll();

		var elements = wabi.element;
		for(var n = 0; n < value.length; n++)
		{
			var elementCfg = value[n];
			if(!elementCfg.type) {
				console.warn("(editor.element.template) Undefined element type");
				continue;
			}

			var elementCls = elements[elementCfg.type];
			if(!elementCls) {
				console.warn("(editor.element.template) Undefined element type: " + elementCfg.type);
				continue;
			}

			var element = new elementCls(this);
			element.cfg = elementCfg;
		}
	}
});

"use strict";

wabi.element("text", 
{
	state: {
		value: ""
	},

	set_value: function(value) {
		this.html(value);
	}
});

"use strict";

wabi.element("upload",
{
	prepare: function()
	{
		this.attrib("type", "file");
		this.attrib("multiple", "");
		this.attrib("directory", "");
	},

	set_value: function(value) {
		this.domElement.value = value;
	},

	open: function() {
		this.domElement.click();
	},

	get files() {
		return this.domElement.files;
	},

	//
	tag: "input"
});

"use strict";

wabi.element("word", 
{
	state: {
		value: ""
	},

	prepare: function()
	{
		this.attrib("spellcheck", "false");
		this.attrib("tabindex", "0");
	},

	set_value: function(value)
	{
		this.html(value);

		if(this.$value && value && value !== this.$value) 
		{
			this.setCls("highlight", true);
			
			var self = this;
			setTimeout(function() {
				self.setCls("highlight", false);
			}, 600);
		}			
	},

	set editable(value)
	{
		if(this._editable === value) { return; }
		this._editable = value;

		if(!value) {
			this.domElement.contentEditable = "false";
		}
	},

	get editable() {
		return this._editable;
	},

	handle_dblclick: function(event)
	{
		if(this.editable) {
			this.domElement.contentEditable = "true";
			this.domElement.focus();
			meta.selectElementContents(this.domElement);
		}
	},

	handle_blur: function(event)
	{
		var newValue = this.html();
		if(newValue) {
			this.$value = newValue;
		}
		else {
			this.html(this.$value);
		}

		if(this.editable) {
			this.domElement.contentEditable = "false";
		}
	},

	handle_keydown: function(event)
	{
		var keyCode = event.domEvent.keyCode;

		// only 0..9, a..z, A..Z, -, _, ., space
		if((keyCode > 47 && keyCode < 58) || 
		   (keyCode > 64 && keyCode < 91) || 
		   (keyCode > 96 && keyCode < 123) || keyCode === 95 || keyCode === 189 || keyCode === 190 || keyCode === 32)
		{
			return;
		}

		// Backspace
		if(keyCode === 8) {
			return;
		}
		// Arrow keys
		else if(keyCode >= 37 && keyCode <= 40) {
			return;
		}
		// Esc
		else if(keyCode === 27) {
			this.domElement.blur();
		}
		// Enter
		else if(keyCode === 13) {
			this.domElement.blur();
			this.domElement.scrollIntoView(true);
		}

		event.domEvent.preventDefault();
	},

	handle_change: function(event) {
		this.$value = this.html();
	},

	//
	_editable: true
});

"use strict";

wabi.element("wrapped", 
{
	create: function(params) 
	{
		if(typeof(params) === "string") {
			this.tag = params;
		}
		else if(params instanceof Element) {
			this.tag = params.tagName;
			this.domElement = params;
		}
	}
});

"use strict";

wabi.event = function(name, element, domEvent)
{
	this.name = name;
	this.element = element;

	if(domEvent) 
	{
		this.domEvent = domEvent;

		if(domEvent.clientX) 
		{
			this.x = domEvent.clientX;
			this.y = domEvent.clientY;
			this.updateElementOffset(event);
		}
		else {
			this.x = 0;
			this.y = 0;
		}
	}		
};

wabi.event.prototype = 
{
	updateElementOffset: function()
	{
		var offsetLeft = 0;
		var offsetTop = 0;

		if(this.element)
		{
			var domElement = this.element.domElement;
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
		}

		if(this.element && this.element.domElement.tagName === "IFRAME") 
		{
			var rect = this.element.domElement.getBoundingClientRect();
			this.x += rect.left;
			this.y += rect.top;
		}
	},	

	stop: function()
	{
		this.domEvent.preventDefault();
		this.domEvent.stopPropagation();		
	},

	get target() {
		return this.domEvent.target.holder;
	},

	//
	domEvent: null,
	x: 0,
	y: 0
};

