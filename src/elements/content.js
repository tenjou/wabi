"use strict";

wabi.element("content", 
{
	process_value: function(value) 
	{
		console.log("set_content")

		this.removeAll();
		
		for(var n = 0; n < value.length; n++)
		{
			var elementCfg = value[n];
			if(!elementCfg.type) {
				console.warn("(wabi.element.container) Undefined element type");
				continue;
			}

			var elementCls = wabi.element[elementCfg.type];
			if(!elementCls) {
				console.warn("(wabi.element.container) Undefined element type: " + elementCfg.type);
				continue;
			}

			var element = new elementCls(this);
			element.cfg = elementCfg;
		}	
	}
});
