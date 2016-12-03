import wabi from "../wabi";

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
