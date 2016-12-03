import wabi from "../wabi";

wabi.element("template", 
{
	process_value: function(value)
	{
		this.removeAll();

		const elements = wabi.element;
		for(let n = 0; n < value.length; n++)
		{
			const elementCfg = value[n];
			if(!elementCfg.type) {
				console.warn("(editor.element.template) Undefined element type");
				continue;
			}

			const elementCls = elements[elementCfg.type];
			if(!elementCls) {
				console.warn("(editor.element.template) Undefined element type: " + elementCfg.type);
				continue;
			}

			const element = new elementCls(this);
			element.cfg = elementCfg;
		}
	}
});
