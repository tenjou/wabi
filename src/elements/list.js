"use strict";

wabi.element("list",
{
	setup: function()
	{
		this.cache = {
			itemElements: [],
			selectable: true,
			selected: null
		};
	},

	process_value: function(value) {
		this.removeAll();
		this.fillFolder(value);
	},

	fillFolder: function(content)
	{	
		for(var n = 0; n < content.length; n++) {
			this.createItem(content[n]);
		}
	},

	createItem: function(item)
	{
		var element = wabi.createElement("listItem", this);
		element.on("click", this.handleItem_click, this);
		element.on("update", this.handleItem_update, this);
		element.state = item;
	},

	handleItem_click: function(event) {
		//this.state.sele
		this.select = event.element;
	},

	handleItem_update: function(event)
	{

	},

	set select(element)
	{
		if(!(element instanceof wabi.element.listItem)) { return; }
		if(!this.cache.selectable) { return; }

		element.state.select = true;
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
	tag: "list",
	cache: null
});

wabi.element("listItem",
{
	content: 
	{
		name: {
			type: "word",
			link: "value"
		}
	},

	// setup: function()
	// {
	// 	this.attrib("tabindex", "1");

		// if(this._draggable) {
		// 	this.attrib("draggable", "true");
		// }
	// },


	process_folder: function(value)
	{

	},

	process_open: function(value)
	{

	},

	process_select: function(value)
	{
		var cache = this.parent.cache;

		if(value)
		{
			if(cache.selected) {
				cache.selected.select = false;
			}

			cache.selected = this;

			this.addCls("selected");
		}
		else
		{
			if(cache.selected !== this) { return; }
			cache.selected = null;

			this.removeCls("selected");
		}
	},

	process_draggable: function(value)
	{
		if(value) {
			this.attrib("draggable", "true");
		}
		else {
			this.attrib("draggable", "false");
		}
	},

	handle_click: function(event)
	{
		if(this.state.folder) {
			this.state.folder = !this.state.open;
		}
	},

	handle_dblclick: function(event)
	{
		console.log("dblclick");
	},

	handleUpdate_name: function(event) {
		this.state.value = event.element.state.value;
	},

	//
	params: {
		folder: false,
		open: false,
		select: false,
		draggable: false
	},

	//
	tag: "item"
});
