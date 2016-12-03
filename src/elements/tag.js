import wabi from "../wabi";

wabi.element("tag",
{
	set_value: function(value)
	{
		if(!value) {
			this.html("");
		}
		else {
			this.html(value);
		}
	}
});
