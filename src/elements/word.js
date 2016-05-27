"use strict";

wabi.element("word", 
{
	setup: function()
	{
		this.attrib("spellcheck", "false");
		this.attrib("tabindex", "0");
	},

	process_value: function(value)
	{
		this.domElement.innerHTML = value;
	},

	process_editable: function(value)
	{

	},

	process_placeholder: function(value) {
		this.attrib("placeholder", value);
	},

	handle_click: function(event)
	{

	},

	handle_focus: function(event)
	{
		this.domElement.contentEditable = "true";
		this.domElement.focus();
		meta.selectElementContents(this.domElement);
	},

	handle_blur: function(event)
	{
		console.log("blur")
		this.state.value = "stuff";
	},

	handle_keydown: function(event)
	{

	},

	//
	params: {
		placeholder: null,
		editable: true
	},

	//
	tag: "word"
});
