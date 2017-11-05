import { VNode } from "./VNode"

const stack = new Array(128)
let stackIndex = 0
let bodyNode = null
let prevMountedElement = null

const elementOpen = function(type, props, srcElement)
{
	const parent = stack[stackIndex]

	let node = parent.children[parent.index]
	if(!node) 
	{
		const element = srcElement || document.createElement(type)
		node = new VNode(parent.index, type, props, element, parent)

		if(prevMountedElement) {
			node.prevElement = prevMountedElement
			prevMountedElement = null
		}

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
			const element = srcElement || document.createElement(type)

			if(node.component) 
			{
				node.component.remove()
				node.component = null

				const children = node.children
				for(let n = 0; n < children.length; n++) {
					element.appendChild(children[n].element)
				}
			}
			else 
			{
				const prevElement = node.element

				while(prevElement.firstChild) { 
					element.appendChild(prevElement.firstChild)
				}

				prevElement.parentElement.replaceChild(element, prevElement)
			}

			if(props) 
			{
				for(let key in props) {
					setProp(element, key, props[key])
				}
				node.props = props
			}
			
			node.id = parent.index
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

		if(prevMountedElement) {
			node.prevElement = prevMountedElement
			prevMountedElement = null
		}
		else {
			node.prevElement = null
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
	
	if(node.type !== type) {
		console.error(`(Element.close) Unexpected element closed: ${type} but was expecting: ${node.type}`)
	}

	if(node.index !== node.children.length) {
		removeUnusedNodes(node)
	}
	node.index = 0

	if(!node.element.parentElement) {
		const parent = stack[stackIndex - 1]
		if(node.prevElement) {
			parent.element.insertBefore(node.element, node.prevElement.nextSibling)
		}
		else {
			parent.element.appendChild(node.element)
		}
	}

	stackIndex--
	prevMountedElement = node.element
}

const elementVoid = function(type, props) {
	const node = elementOpen(type, props)
	elementClose(type)
	return node
}

const element = function(element, props) {
	const node = elementOpen(element.localName, props, element)
	elementClose(element.localName)
	return node
}

const componentVoid = function(componentCls, props)
{
	const parent = stack[stackIndex]

	let node = parent.children[parent.index]
	if(!node) {
		return createComponent(componentCls, parent, node, props)		
	}
	else 
	{
		const component = node.component
		if(component) 
		{
			if(component.constructor !== componentCls) {
				component.remove()
				createComponent(componentCls, parent, node, props)
			}
			else 
			{
				const prevProps = node.props
				if(props !== prevProps) 
				{
					if(props)
					{
						if(prevProps)
						{
							for(let key in prevProps) 
							{
								if(props[key] === undefined) {
									if(key[0] === "$") {
										component[key] = component.state[key.slice(1)]
									} 
									else {
										component[key] = null
									}
								}
							}

							for(let key in props) {
								const value = props[key]
								if(component[key] !== value) {
									component[key] = value
								}
							}
						}
						else
						{
							for(let key in props) {
								component[key] = props[key]
							}							
						}

						node.props = props
					}
					else if(prevProps) 
					{
						for(let key in prevProps) {
							if(key[0] === "$") {
								component[key] = component.state[ket.slice(1)]
							} 
							else {
								component[key] = null
							}
						}

						node.props = null
					}
				}

				if(component.dirty) 
				{
					parent.index++
					stackIndex++
					stack[stackIndex] = node
					
					component.render()
					component.index = 0
					component.dirty = false
				
					if(node.index !== node.children.length) {
						removeUnusedNodes(node)
					}

					node.index = 0

					stackIndex--
				}
				else {
					parent.index++
				}				
			}
		}
		else {
			return createComponent(componentCls, parent, node, props)
		}
	}

	return node.component
}

const createComponent = function(componentCls, parent, node, props) 
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

	let vnode
	if(node) 
	{
		if(node.component) {
			vnode = node
			vnode.index = 0
		}
		else {
			vnode = new VNode(0, null, props, parent.element, parent)
			vnode.children.push(node)
			vnode.id = node.id
			node.parent.children[node.id] = vnode
			node.id = 0
			node.index = 0
			node.parent = vnode
		}
	}
	else {
		vnode = new VNode(0, null, props, parent.element, parent)
		parent.children.push(vnode)
	}

	vnode.component = component
	vnode.prevElement = prevMountedElement

	parent.index++
	stackIndex++
	stack[stackIndex] = vnode

	component.vnode = vnode
	component.depth = stackIndex
	component.render()
	component.dirty = false

	if(vnode.index !== vnode.children.length) {
		removeUnusedNodes(vnode)
	}

	vnode.index = 0

	stackIndex--

	return component
}

const text = function(txt)
{
	const parent = stack[stackIndex]
	let node = parent.children[parent.index]
	if(!node) {
		const element = document.createTextNode(txt)
		const node = new VNode(parent.index, "#text", null, element, parent, null)
		parent.children[parent.index] = node
		parent.element.appendChild(element)		
	}
	else 
	{
		if(node.type !== "#text") 
		{
			const element = document.createTextNode(txt)
			node.type = "#text"
			
			if(node.component) {
				node.component.remove()
				node.component = null
				if(node.prevElement) {
					parent.element.insertBefore(element, node.prevElement.nextSibling)
				}
				else {
					parent.element.appendChild(element)
				}
			}
			else {
				node.element.parentElement.replaceChild(element, node.element)
			}

			node.element = element
			removeUnusedNodes(node)			
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

	if(bodyNode.index !== bodyNode.children.length) {
		removeUnusedNodes(bodyNode)
	}

	bodyNode.index = 0
}

const renderInstance = function(instance)
{
	const vnode = instance.vnode
	stackIndex = instance.depth
	stack[instance.depth] = vnode
	prevMountedElement = vnode.prevElement
	instance.render()
	instance.dirty = false

	if(vnode.index !== vnode.children.length) {
		removeUnusedNodes(vnode)
	}

	vnode.index = 0
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
	else {
		if(node.element.parentElement) {
			node.element.parentElement.removeChild(node.element)
		}		
	}
	
	const children = node.children
	for(let n = 0; n < children.length; n++) {
		const child = children[n]
		removeNode(child)
	}

	node.children.length = 0
}

const removeAll = function() {
	removeUnusedNodes(bodyNode)
}

export { 
	elementOpen, 
	elementClose,
	elementVoid,
	element,
	componentVoid,
	text,
	render,
	renderInstance,
	removeAll
}