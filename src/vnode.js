
function VNode(id, type, props, element) {
	this.id = id
	this.type = type 
	this.props = props
	this.element = element
	this.children = [] 
	this.index = 0
	this.component = null
}

export { VNode }