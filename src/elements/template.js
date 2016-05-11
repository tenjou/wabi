"use strict";

wabi.element("template", 
{
	process_value: function(value)
	{
		this.removeAll();

		var elements = wabi.element;
		for(var n = 0; n < value.length; n++)
		{
			var elementCfg = value[n];
			if(!elementCfg.type) {
				console.warn("(editor.element.template) Undefined element type");
				continue;
			}

			var elementCls = elements[elementCfg.type];
			if(!elementCls) {
				console.warn("(editor.element.template) Undefined element type: " + elementCfg.type);
				continue;
			}

			var element = new elementCls(this);
			element.cfg = elementCfg;
		}
	}
});
