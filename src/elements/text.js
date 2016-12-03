import wabi from "../wabi";

wabi.element("text", 
{
	state: {
		value: ""
	},

	set_value: function(value) {
		this.html(value);
	}
});
