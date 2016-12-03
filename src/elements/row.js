import wabi from "../wabi";

wabi.element("row", 
{
	set_value: function(value) 
	{
		this.removeAll();
		
		if(!value) { return; }

		for(const n = 0; n < value.length; n++)
		{
			const elementCfg = value[n];

			const element = wabi.createElement(elementCfg.type, this);
			if(!element) {
				continue;
			}

			for(const key in elementCfg) 
			{
				if(key === "type") { continue; }

				element[key] = elementCfg[key];
			}
		}	
	}
});
