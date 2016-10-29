"use strict";

wabi.element("error", 
{
	state: {
		value: "",
		types: {}
	},

	render: function() 
	{
		if(!this.$value) {
			return "";
		}

		var text = this.$types[this.$value];
		if(!text) {
			return "";
		}

		return text;
	}
});
