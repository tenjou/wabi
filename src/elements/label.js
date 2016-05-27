"use strict";

wabi.element("label",
{
	content: {
		name: {
			type: "text",
			link: "value"
		},
		content: {
			type: "content",
			link: "content"
		}
	},

	process_value: function(value) {
		console.log("value", value)
	},

	process_content: function(value) {
		console.log("content", value)
	}
});

