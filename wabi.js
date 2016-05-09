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
		this.fragmentsCached[id] = fragment;

		return fragment;
	},

	element: function(name, proto) 
	{
		function element(parent, createParams) {
			wabi.element.basic.call(this, parent, createParams);
		};

		element.prototype = Object.create(this.element.basic.prototype);
		element.prototype.constructor = element;
		element.prototype.$name = name;
		Object.assign(element.prototype, proto);

		var events = [];
		var searchFor = "handle_";
		for(var key in element.prototype) 
		{
			var index = key.indexOf(searchFor);
			if(index !== -1) {
				events.push(key.slice(searchFor.length));
			} 
		}

		if(events.length > 0) {
			element.prototype.initialEvents = events;
		}

		this.element[name] = element;
	},	

	//
	fragments: {},
	fragmentsCached: {}	
};

wabi.state = function() {};

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
