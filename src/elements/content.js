import wabi from "../wabi";

wabi.element("content", 
{
	state: {
		value: ""
	},

	render() {
		this.$loadValue(this.$value);
	},

	$loadValue(value)
	{
		if(!value) { return; }

		const type = typeof(value);
		if(type === "object")
		{
			if(value instanceof Array)
			{
				for(let n = 0; n < value.length; n++)
				{
					const state = value[n];
					if(typeof(state) === "string") {
						const template = wabi.getFragment(state);
						this.$loadValue(template);
					}
					else {
						this.$loadState(state);
					}
				}	
			}
			else {
				this.$loadState(value);
			}
		}
		else 
		{
			const fragment = wabi.getFragment(value);
			if(!fragment) {
				console.warn("(wabi.element.content) No such fragment found: " + value);
				return;
			}

			this.$loadValue(fragment);
		}
	},

	$loadState: function(state)
	{
		if(!state.type) {
			console.warn("(wabi.elements.content) Undefined element type");
			return;
		}

		const element = wabi.createElement(state.type, this);
		if(!element) { return; }

		for(let key in state)
		{
			if(key === "type") { continue; }

			element[key] = state[key];
		}
	},

	set padding(value) 
	{
		if(value > 0) {
			this.style("margin", value + "px");
		}
		else if(this.style("margin")) {
			this.style("margin", "");
		}
	},

	get padding() {
		return this._padding;
	},

	set height(value) 
	{
		this.style("height", value + "px");
	},

	get height() {
		return this._height;
	},

	//
	_padding: 0,
	_height: 0	
});