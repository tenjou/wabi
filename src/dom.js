import { VNode } from "./VNode"

const stack = new Array(128)
let stackIndex = 0
let bodyNode = null

const elementOpen = function(type, props)
{
	const parent = stack[stackIndex]

	let node = parent.children[parent.index]
	if(!node) 
	{
		const element = document.createElement(type)
		node = new VNode(parent.index, type, props, element, parent)

		if(props) {
			for(let key in props) {
				setProp(element, key, props[key])
			}
		}

		parent.children[parent.index] = node
	}
	else 
	{
		if(node.type !== type) 
		{
			if(node.component) {
				node.component.remove()
				node.component = null
			}

			const prevElement = node.element
			const children = node.children
			const element = document.createElement(type)
			for(let n = 0; n < children.length; n++) {
				element.appendChild(children[n].element)
			}

			while(prevElement.firstChild) { 
				element.appendChild(prevElement.firstChild)
			}

			if(props) 
			{
				for(let key in props) {
					setProp(element, key, props[key])
				}
				node.props = props
			}

			prevElement.parentElement.replaceChild(element, prevElement)
			node.type = type
			node.element = element
		}
		else
		{
			const element = node.element
			const prevProps = node.props

			if(props !== prevProps)
			{
				if(props) 
				{
					if(prevProps) 
					{
						for(let key in prevProps) {
							if(props[key] === undefined) {
								unsetProp(element, key)
							}
						}

						for(let key in props) {
							const value = props[key]
							if(value !== prevProps[key]) {
								setProp(element, key, value)
							}
						}
					}
					else 
					{
						for(let key in props) {
							setProp(element, key, props[key])
						}	
					}

					node.props = props
				}
				else 
				{
					if(prevProps) 
					{
						for(let key in prevProps) {
							unsetProp(element, key)
						}

						node.props = null
					}				
				}
			}
		}
	}

	parent.index++
	stackIndex++
	stack[stackIndex] = node

	return node
}

const elementClose = function(type)
{
	const node = stack[stackIndex]
	const parent = stack[stackIndex - 1]

	if(node.type !== type) {
		console.error("type-error")
	}

	if(node.index !== node.children.length) {
		removeUnusedNodes(node)
	}

	node.index = 0
	stackIndex--

	if(!node.element.parentElement) {
		parent.element.appendChild(node.element)
	}
}

const elementVoid = function(type, props)
{
	const node = elementOpen(type, props)
	elementClose(type)

	return node
}

const componentVoid = function(componentCls, props)
{
	const parent = stack[stackIndex]

	let node = parent.children[parent.index]
	if(!node) {
		return createComponent(componentCls, node, props)		
	}
	else 
	{
		const component = node.component
		if(component) 
		{
			if(component.constructor !== componentCls) {
				component.remove()
				createComponent(componentCls, node, props)
			}
			else 
			{
				if(props) {
					for(let key in props) {
						component[key] = props[key]
					}
				}	

				if(component.dirty) {
					component.render()
					component.dirty = false
				}
				else {
					parent.index++
				}				
			}
		}
		else {
			createComponent(componentCls, node, props)
		}
	}

	return node.component
}

const createComponent = function(componentCls, node, props) 
{
	const component = new componentCls()

	if(props) {
		for(let key in props) {
			component[key] = props[key]
		}
	}

	if(component.mount) {
		component.mount()
	}

	component.render()
	component.dirty = false
	component.depth = stackIndex + 1

	node = stack[stackIndex + 1]
	if(node) {
		node.component = component
		component.vnode = node
	}

	return component
}

const text = function(txt)
{
	const parent = stack[stackIndex]
	let node = parent.children[parent.index]
	if(!node) {
		const element = document.createTextNode(txt)
		const node = new VNode(parent.index, "#text", null, element, parent)
		parent.children[parent.index] = node
		parent.element.appendChild(element)		
	}
	else 
	{
		if(node.type !== "#text") {
			const element = document.createTextNode(txt)
			node.element.parentElement.replaceChild(element, node.element)
			node.type = "#text"
			node.element = element
		}
		else if(node.element.nodeValue !== txt) {
			node.element.nodeValue = txt
		}
	}

	parent.index++

	return node
}

const setProp = function(element, name, value) 
{
	if(name === "class") {
		element.className = value
	}
	else if(name === "style") 
	{
		if(typeof value === "object") {
			const elementStyle = element.style
			for(let key in value) {
				elementStyle[key] = value[key]
			}
		}
		else {
			element.style.cssText = value
		}
	}
	else if(name[0] === "o" && name[1] === "n") {
		element[name] = value
	} 
	else {
		element.setAttribute(name, value)
	}
}

const unsetProp = function(element, name) 
{
	if(name === "class") {
		element.className = ""
	}
	else if(name === "style") {
		element.style.cssText = ""
	}
	else if(name[0] === "o" && name[1] === "n") {
		element[name] = null
	} 
	else {
		element.removeAttribute(name)
	}	
}

const render = function(component, parentElement)
{
	if(!bodyNode) {
		bodyNode = new VNode(0, "body", null, parentElement, null)
	}
	
	stackIndex = 0
	stack[0] = bodyNode

	componentVoid(component)

	bodyNode.index = 0
}

const renderInstance = function(instance)
{
	const vnode = instance.vnode
	const parentVNode = vnode.parent
	parentVNode.index = vnode.id

	stackIndex = instance.depth
	stack[instance.depth] = parentVNode

	instance.render()
	instance.dirty = false

	parentVNode.index = 0	
}

const removeUnusedNodes = function(node)
{
	const children = node.children
	for(let n = node.index; n < children.length; n++) {
		const child = children[n]
		removeNode(child)
	}

	children.length = node.index
}

const removeNode = function(node)
{
	if(node.component) {
		node.component.remove()
	}

	node.children.length = 0
	node.element.parentElement.removeChild(node.element)

	const children = node.children
	for(let n = 0; n < children.length; n++) {
		const child = children[n]
		removeNode(child)
	}
}

const removeAll = function() {
	removeUnusedNodes(bodyNode)
}

export { 
	elementOpen, 
	elementClose,
	elementVoid,
	componentVoid,
	text,
	render,
	renderInstance,
	removeAll
}