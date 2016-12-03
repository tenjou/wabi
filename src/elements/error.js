import wabi from "../wabi";

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

		const text = this.$types[this.$value];
		if(!text) {
			return "";
		}

		return text;
	}
});
