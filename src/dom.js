import { VNode } from "./vnode"

const stack = new Array(64)
const components = {}
let stackIndex = 0
let bodyNode = null

const elementOpen = function(type, props, srcElement)
{
	const parent = stack[stackIndex]
	let prevNode = parent.children[parent.index]
	let vnode = prevNode

	if(!prevNode) 
	{
		const element = srcElement || document.createElement(type)
		vnode = new VNode(parent.index, type, props, element, parent)

		if(props) {
			for(let key in props) {
				setProp(element, key, props[key])
			}
		}

		vnode.props = props
		parent.children[parent.index] = vnode
	}
	else 
	{
		if(prevNode.type !== type) 
		{
			const element = srcElement || document.createElement(type)

			if(prevNode.component) 
			{
				vnode = new VNode(prevNode.index, type, props, element, parent)

				const children = prevNode.children
				prevNode.children = vnode.children
				vnode.children = children

				for(let n = 0; n < children.length; n++) 
				{
					const child = children[n]
					child.parent = vnode

					if(!child.component) {
						element.appendChild(child.element)
					}
					else {
						element.appendChild(node.component.base)
						child.element = element
						appendChildren(element, child.children)
					}
				}	

				removeComponent(prevNode)

				prevNode.parent.children[prevNode.index] = vnode
			}
			else 
			{
				const prevElement = prevNode.element

				while(prevElement.firstChild) { 
					element.appendChild(prevElement.firstChild)
				}

				prevElement.parentElement.replaceChild(element, prevElement)

				vnode.type = type
				vnode.element = element
			}

			if(props) 
			{
				for(let key in props) {
					setProp(element, key, props[key])
				}
				vnode.props = props
			}
		}
		else
		{
			const element = prevNode.element
			const prevProps = prevNode.props

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

					prevNode.props = props
				}
				else 
				{
					if(prevProps) 
					{
						for(let key in prevProps) {
							unsetProp(element, key)
						}

						prevNode.props = null
					}				
				}
			}
		}
	}

	parent.index++
	stackIndex++
	stack[stackIndex] = vnode

	return vnode
}

const appendChildren = (node, element, children) => {
	for(let n = 0; n < children.length; n++) {
		const child = children[n]
		if(!child.component) {
			element.appendChild(child.element)
		}
		else {
			element.appendChild(node.component.base)
			child.element = element
			appendChildren(node, element, child.children)
		}
	}	
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
		appendElement(node.element, node.parent)
	}

	stackIndex--
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

const componentVoid = (ctor, props) => 
{
	const parent = stack[stackIndex]
	const node = parent.children[parent.index]
	let component
	let vnode

	if(node) 
	{
		component = node.component
		if(component)
		{
			if(component.constructor === ctor) {
				diffComponentProps(component, node, props)
				vnode = node
			}
			else 
			{
				vnode = createComponent(ctor, node, parent)
				component = vnode.component

				const children = node.children
				node.children = vnode.children
				vnode.children = children

				vnode.element.insertBefore(component.base, node.component.base)
				removeComponent(node)

				for(let n = 0; n < children.length; n++) {
					children[n].parent = vnode
				}
				parent.children[vnode.id] = vnode

				if(props) {
					for(let key in props) {
						component[key] = props[key]
					}
				}
			}			
		}
		else 
		{
			vnode = createComponent(ctor, node, parent)
			component = vnode.component

			vnode.children.push(node)
			vnode.element.insertBefore(component.base, node.element)
			node.index = 0
			node.id = 0
			node.parent = vnode	

			parent.children[vnode.id] = vnode	

			if(props) {
				for(let key in props) {
					component[key] = props[key]
				}
			}
		}
	}
	else 
	{
		vnode = createComponent(ctor, null, parent)
		component = vnode.component

		vnode.id = parent.children.length
		parent.children.push(vnode)
		parent.element.appendChild(component.base)

		parent.children[vnode.id] = vnode			

		if(props) {
			for(let key in props) {
				component[key] = props[key]
			}
		}
	}

	if(component.mount) {
		component.mount()
	}

	parent.index++
	stackIndex++
	stack[stackIndex] = vnode

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

const diffComponentProps = (component, node, props) => 
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
}

const createComponent = (ctor, node, parent) => 
{
	const buffer = components[ctor.prototype.__componentIndex]
	let component = buffer ? buffer.pop() : null
	let vnode

	if(!component) {
		component = new ctor()
		vnode = new VNode(0, null, null, parent.element, parent)
		vnode.component = component	
		component.vnode = vnode
	}
	else {
		vnode = component.vnode
	}

	if(node) {
		vnode.id = node.id
	}
	vnode.parent = parent
	vnode.element = parent.element
	return vnode
}

const removeComponent = (node) => 
{
	const component = node.component
	const buffer = components[component.__componentIndex]
	if(buffer) {
		buffer.push(component)
	}
	else {
		components[component.__componentIndex] = [ component ]
	}

	component.remove()
	component.base.remove()
	removeUnusedNodes(node)
}

const text = (text) =>
{
	const parent = stack[stackIndex]
	let node = parent.children[parent.index]

	if(node) 
	{
		if(node.type === "#text") {
			if(node.element.nodeValue !== text) {
				node.element.nodeValue = text
			}
		}
		else 
		{
			const element = document.createTextNode(text)

			if(node.component) {
				const vnodeNew = new VNode(parent.index, "#text", null, element, parent, null)
				parent.children[parent.index] = vnodeNew				
				node.element.insertBefore(element, node.component.base)
				node.index = 0
				removeComponent(node)
			}
			else {
				node.element.parentElement.replaceChild(element, node.element)
				node.type = "#text"
				node.element = element
			}
		}
	}
	else {
		const element = document.createTextNode(text)
		const vnode = new VNode(parent.index, "#text", null, element, parent, null)
		parent.children[parent.index] = vnode
		parent.element.appendChild(element)	
	}

	parent.index++

	return node
}

const appendElement = (element, parent) => {
	const component = parent.component
	if(component) {
		if(parent.id === 0) {
			parent.element.insertBefore(element, component.base.nextSibling)
		}
		else {
			const prev = parent.children[parent.index - 1]
			parent.element.insertBefore(element, prev.element.nextSibling)
		}
	}
	else {
		parent.element.appendChild(element)
	}	
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
	instance.render()
	instance.dirty = false

	if(vnode.index !== vnode.children.length) {
		removeUnusedNodes(vnode)
	}

	vnode.index = 0
}

const removeUnusedNodes = (node) =>
{
	const children = node.children
	for(let n = node.index; n < children.length; n++) {
		const child = children[n]
		removeNode(child)
	}

	children.length = node.index
}

const removeNode = (node) =>
{
	if(node.component) {
		removeComponent(node)
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

const removeAll = () => {
	removeUnusedNodes(bodyNode)
}

const getBodyNode = () => {
	return bodyNode
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
	removeAll,
	getBodyNode
}