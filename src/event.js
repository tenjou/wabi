
export class ElementEvent
{
	constructor(name, element, domEvent)
	{
		this.name = name;
		this.element = element;

		if(domEvent) 
		{
			this.domEvent = domEvent;

			if(domEvent.clientX) 
			{
				this.x = domEvent.clientX;
				this.y = domEvent.clientY;
				this.updateElementOffset(event);
			}
			else {
				this.x = 0;
				this.y = 0;
			}
		}
		else 
		{
			this.domEvent = null;
			this.x = 0;
			this.y = 0;
		}
	}	

	updateElementOffset()
	{
		let offsetLeft = 0;
		let offsetTop = 0;

		if(this.element)
		{
			var domElement = this.element.domElement;
			if(domElement.offsetParent)
			{
				do 
				{
					if(domElement.tagName === "IFRAME") {
						offsetLeft += domElement.offsetLeft;
						offsetTop += domElement.offsetTop;
					}

				} while(domElement = domElement.offsetParent);
			}
		}

		if(this.element && this.element.domElement.tagName === "IFRAME") 
		{
			var rect = this.element.domElement.getBoundingClientRect();
			this.x += rect.left;
			this.y += rect.top;
		}
	}

	stop()
	{
		this.domEvent.preventDefault();
		this.domEvent.stopPropagation();		
	}

	get target() {
		return this.domEvent.target.holder;
	}
}
