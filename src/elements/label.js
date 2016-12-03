import wabi from "../wabi";

wabi.element("label",
{
	elements: 
	{
		name: {
			type: "text",
			link: "name"
		},
		content: {
			type: "content",
			link: "value"
		}
	}
});
