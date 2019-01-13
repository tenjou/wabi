import { VNode } from "./vnode"

const stack = new Array(64)
const components = {}
let stackIndex = 0
let bodyNode = null

const elementOpen = (type, props, srcElement) => {
	const parent = stack[stackIndex]
	let prevNode = parent.children[parent.index]
	let vnode = prevNode

	if(!prevNode) {
		const element = srcElement || document.createElement(type)
		vnode = new VNode(parent.index, type, null, element)
		element.__vnode = vnode

		if(props) {
			for(let key in props) {
				setProp(element, key, props[key])
			}
			vnode.props = props
		}
		
		if(parent.component) {
			if(parent.index > 0) {
				const parentParent = stack[stackIndex - 1]
				const parentNext = parentParent.children[parent.id + 1]
				if(parentNext && parentNext.component) {
					parent.element.insertBefore(element, parentNext.component.base)
				}
				else {
					parent.element.insertBefore(element, parent.children[parent.index - 1].element.nextSibling)
				}
			}
			else {
				parent.element.insertBefore(element, parent.component.base.nextSibling)
			}
		}
		else {
			parent.element.appendChild(element)
		}

		parent.children.push(vnode)
	}
	else 
	{
		if(vnode.type !== type) {
			const element = srcElement || document.createElement(type)
			element.__vnode = vnode

			if(vnode.component) {
				vnode.element.replaceChild(element, vnode.component.base)
				removeComponent(vnode)
				vnode.component = null
				appendChildren(element, vnode.children)	
			}
			else {
				const prevElement = prevNode.element
				appendChildren(element, vnode.children)
				prevElement.parentElement.replaceChild(element, prevElement)
			}

			vnode.element = element
			vnode.type = type

			if(props) {
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

const appendChildren = (element, children) => {
	for(let n = 0; n < children.length; n++) {
		const child = children[n]
		if(child.component) {
			element.appendChild(child.component.base)
			child.element = element
			appendChildren(element, child.children)			
		}
		else {
			element.appendChild(child.element)
		}
	}	
}

const elementClose = (type) => {
	const node = stack[stackIndex]
	
	if(node.type !== type) {
		console.error(`(Element.close) Unexpected element closed: ${type} but was expecting: ${node.type}`)
	}
	if(node.index !== node.children.length) {
		removeUnusedNodes(node)
	}

	node.index = 0
	stackIndex--
}

const elementVoid = (type, props) => {
	const node = elementOpen(type, props)
	elementClose(type)
	return node
}

const element = (element, props) => {
	const node = elementOpen(element.localName, props, element)
	elementClose(element.localName)
	return node
}

const componentVoid = (ctor, props) => {
	const parent = stack[stackIndex]
	let vnode = parent.children[parent.index]
	let component

	if(vnode) {
		component = vnode.component
		if(component) {
			if(component.constructor === ctor) {
				diffComponentProps(component, vnode, props)
			}
			else {
				const newComponent = createComponent(ctor)
				newComponent.vnode = vnode
				vnode.element.replaceChild(newComponent.base, component.base)
				removeComponent(vnode)
				component = newComponent
				vnode.component = newComponent
				vnode.props = props
				for(let key in props) {
					newComponent[key] = props[key]
				}
			}	
		}
		else {
			const vnodeNew = new VNode(vnode.id, null, null, parent.element)
			component = createComponent(ctor)
			component.vnode = vnodeNew
			vnodeNew.component = component
			vnodeNew.children.push(vnode)
			parent.element.insertBefore(component.base, vnode.element)
			parent.children[vnode.id] = vnodeNew

			vnode.id = 0
			vnode.parent = vnodeNew
			vnode = vnodeNew

			diffComponentProps(component, vnode, props)			
		}
	}
	else {
		vnode = new VNode(parent.children.length, null, null, parent.element)
		component = createComponent(ctor)
		component.vnode = vnode
		vnode.component = component
		parent.children.push(vnode)
		parent.element.appendChild(component.base)	
		diffComponentProps(component, vnode, props)	
	}

	if(component.mounted) {
		component.mounted()
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

const diffComponentProps = (component, node, props) => {
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
					component[key] = component.state[key.slice(1)]
				} 
				else {
					component[key] = null
				}
			}

			node.props = null
		}
	}
}

const createComponent = (ctor) => {
	const buffer = components[ctor.prototype.__componentIndex]
	let component = buffer ? buffer.pop() : null
	if(!component) {
		component = new ctor()
	}
	if(component.mount) {
		component.mount()
	}	
	component.dirty = true
	return component
}

const removeComponent = (vnode) => {
	const props = vnode.props
	const component = vnode.component
	const buffer = components[component.__componentIndex]

	if(buffer) {
		buffer.push(component)
	}
	else {
		components[component.__componentIndex] = [ component ]
	}

	for(let key in props) {
		component[key] = null
	}
	vnode.props = null

	component.remove()
	component.base.remove()
}

const text = (text) =>
{
	const parent = stack[stackIndex]
	let vnode = parent.children[parent.index]

	if(vnode) 
	{
		if(vnode.type === "#text") {
			if(vnode.element.nodeValue !== text) {
				vnode.element.nodeValue = text
			}
		}
		else 
		{
			const element = document.createTextNode(text)
			if(vnode.component) {			
				vnode.element.replaceChild(element, vnode.component.base)
				removeComponent(vnode)
				vnode.component = null
			}
			else {
				vnode.element.parentElement.replaceChild(element, vnode.element)
			}

			removeUnusedNodes(vnode)
			vnode.type = "#text"
			vnode.element = element
		}
	}
	else {
		const element = document.createTextNode(text)
		vnode = new VNode(parent.children.length, "#text", null, element)
		parent.children.push(vnode)
		parent.element.appendChild(element)	
	}

	parent.index++
	return vnode
}

const setProp = (element, name, value) => {
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
	else if(typeof element[name] === "boolean") {
		element[name] = true
	}	
	else {
		element.setAttribute(name, value)
	}
}

const unsetProp = (element, name) => {
	if(name === "class") {
		element.className = ""
	}
	else if(name === "style") {
		element.style.cssText = ""
	}
	else if(name[0] === "o" && name[1] === "n") {
		element[name] = null
	} 
	else if(typeof element[name] === "boolean") {
		element[name] = false
	}
	else {
		element.removeAttribute(name)
	}	
}

const render = (component, parentElement, props) => {
	if(!bodyNode) {
		bodyNode = new VNode(0, "body", null, parentElement)
		parentElement.__vnode = bodyNode
	}
	
	stackIndex = 0
	stack[0] = bodyNode

	componentVoid(component, props)

	if(bodyNode.index !== bodyNode.children.length) {
		removeUnusedNodes(bodyNode)
	}

	bodyNode.index = 0
}

const renderInstance = (instance) => {
	const vnode = instance.vnode
	stackIndex = instance.depth
	stack[instance.depth - 1] = vnode.element.__vnode
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