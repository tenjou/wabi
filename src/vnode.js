
function VNode(id, type, props, element, parent) {
	this.id = id
	this.type = type 
	this.props = props
	this.element = element
	this.parent = parent
	this.prevElement = null
	this.children = [] 
	this.index = 0
	this.component = null
}

export { VNode }