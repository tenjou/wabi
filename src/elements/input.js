"use strict";

wabi.element("input", 
{
	process_value: function(value) {
		this.domElement.value = value;
	},

	process_type: function(value) {
		this.addCls(value);
		this.attrib("type", value);
	},

	process_placeholder: function(value) {
		this.domElement.placeholder = value;
	},

	params: {
		type: "name",
		placeholder: null,
		editable: true
	},

	//
	tag: "input"
});
