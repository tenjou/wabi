"use strict";

wabi.element("panel", 
{
	content: {
		header: { 
			type: "header",
			link: "value"
		},
		content: {
			type: "content",
			link: "content"
		}
	},

	params: {
		value: "header",
		width: 300
	},

	process_width: function(value) {
		this.style("width", value + "px");
	},

	process_height: function(value) {
		this.style("min-height", value + "px");
	}
});
