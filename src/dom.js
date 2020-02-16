const namespaceSVG = "http://www.w3.org/2000/svg"
const stack = new Array(128)
const components = {}
let stackIndex = 0

const elementOpen = (type, props, srcElement) => {
	const parent = stack[stackIndex]
	let prevElement = parent.element.childNodes[parent.index]
	let vnode = null

	if(!prevElement) {
		let element
		if(srcElement) {
			element = srcElement
		}
		else {
			const namespace = (type === "svg") ? namespaceSVG : parent.element.namespaceURI
			element = document.createElementNS(namespace, type)
		}
		vnode = new VNode(parent.index, type, null, element)
		vnode.props = props
		element.vnode = vnode

		if(props) {
			for(let key in props) {
				setProp(element, key, props[key])
			}
		}

		parent.element.appendChild(element)
	}
	else {
		vnode = prevElement.vnode
		if(prevElement.localName === type) {
			const prevProps = vnode.props
			if(props !== prevProps) {
				if(props) {
					if(prevProps) {
						for(let key in prevProps) {
							if(props[key] === undefined) {
								unsetProp(prevElement, key)
							}
						}

						for(let key in props) {
							const value = props[key]
							if(value !== prevProps[key]) {
								setProp(prevElement, key, value)
							}
						}
					}
					else {
						for(let key in props) {
							setProp(prevElement, key, props[key])
						}
					}
					vnode.props = props
				}
				else {
					if(prevProps) {
						for(let key in prevProps) {
							unsetProp(prevElement, key)
						}
						vnode.props = null
					}
				}
			}
		}
		else {
			let element
			if(srcElement) {
				element = srcElement
			}
			else {
				const namespace = (type === "svg") ? namespaceSVG : parent.element.namespaceURI
				element = document.createElementNS(namespace, type)
			}

			if(props) {
				for(let key in props) {
					setProp(element, key, props[key])
				}
			}
			parent.element.replaceChild(element, prevElement)

			if(prevElement.component) {
				removeComponent(prevElement.component)
				prevElement.component = null
			}
			else {
				const children = prevElement.childNodes
				for(let n = 0; n < children.length; n++) {
					element.appendChild(children[n])
				}
			}

			if(!vnode) {
				vnode = new VNode(parent.index, type, null, element)
			}
			vnode.element = element
			vnode.props = props
			element.vnode = vnode
		}
	}

	parent.index++
	stackIndex++
	stack[stackIndex] = vnode

	return vnode
}

const elementClose = (type) => {
	const vnode = stack[stackIndex]
	if(vnode.element.localName !== type) {
		console.error(`(Element.close) Unexpected element closed: ${type} but was expecting: ${vnode.element.nodeName}`)
	}
	if(vnode.index !== vnode.element.childNodes.length) {
		removeUnusedNodes(vnode)
	}
	vnode.index = 0
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
	const child = parent.element.firstChild
	let mounted = true
	let component = child ? child.component : null
	if(component) {
		if(component.constructor === ctor) {
			diffComponentProps(component, props)
			mounted = false
		}
		else {
			const newComponent = createComponent(ctor)
			parent.element.replaceChild(newComponent.__base, component.__base)
			removeComponent(component)

			component = newComponent
			component.__parent = parent
			component.__index = parent.index
			component.__indexEnd = parent.index
			component.__props = props
			for(let key in props) {
				newComponent[key] = props[key]
			}
		}
	}
	else {
		component = createComponent(ctor)
		component.__parent = parent
		component.__index = parent.index
		if(child) {
			parent.element.replaceChild(component.__base, child)
		}
		else {
			parent.element.appendChild(component.__base)
		}
		diffComponentProps(component, props)
	}

	if(mounted && component.mounted) {
		component.mounted()
	}

	const indexEndPrev = component.__indexEnd
	parent.index++
	component.__depth = stackIndex
	component.render()
	component.__dirty = false
	component.__indexEnd = parent.index

	if(indexEndPrev > component.__indexEnd) {
		for(let n = indexEndPrev - 1; n >= component.__indexEnd; n--) {
			removeElement(parent.element.childNodes[n])
		}
	}

	return component
}

const diffComponentProps = (component, props) => {
	const prevProps = component.__props
	if(props === prevProps) {
		return
	}

	if(props) {
		if(prevProps) {
			for(let key in prevProps) {
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
		else {
			for(let key in props) {
				component[key] = props[key]
			}
		}

		component.__props = props
	}
	else if(prevProps) {
		for(let key in prevProps) {
			if(key[0] === "$") {
				component[key] = component.state[key.slice(1)]
			}
			else {
				component[key] = null
			}
		}

		component.__props = null
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
	component.__dirty = true
	return component
}

const removeComponent = (component) => {
	const props = component.__props
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
	component.__props = null
	component.remove()
	component.__base.remove()
}

const text = (text) => {
	const parent = stack[stackIndex]
	const childElement = parent.element.childNodes[parent.index]
	parent.index++

	if(childElement) {
		if(childElement.nodeName === "#text") {
			if(childElement.nodeValue !== text) {
				childElement.nodeValue = text
			}
			return childElement
		}

		const textElement = document.createTextNode(text)
		if(childElement.component) {
			parent.element.replaceChild(textElement, childElement)
			removeComponent(childElement.component)
			childElement.component = null
		}
		else {
			parent.element.replaceChild(textElement, childElement)
		}
		return textElement
	}

	const textElement = document.createTextNode(text)
	parent.element.appendChild(textElement)
	return textElement
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
		element[name] = value
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
	const numChildren = parentElement.childNodes.length
	stackIndex = 0
	stack[0] = parentElement

	componentVoid(component, props)

	if(numChildren > parentElement.childNodes.length) {
		removeUnusedNodes(parentElement, numChildren)
	}
}

const renderInstance = (component) => {
	const indexEndPrev = component.__indexEnd
	const vnode = component.__parent
	vnode.index = component.__index + 1
	stackIndex = component.__depth
	stack[component.__depth] = vnode
	component.render()
	component.__dirty = false
	component.__indexEnd = vnode.index
	vnode.index = 0

	if(indexEndPrev > component.__indexEnd) {
		for(let n = indexEndPrev - 1; n >= component.__indexEnd; n--) {
			removeElement(vnode.element.childNodes[n])
		}
	}
}

const removeUnusedNodes = (vnode) => {
	const children = vnode.element.childNodes
	while(children.length > vnode.index) {
		const child = children[children.length - 1]
		removeElement(child)
	}
}

const removeElement = (element) => {
	if(element.component) {
		removeComponent(element.component)
	}
	else {
		if(element.parentElement) {
			element.parentElement.removeChild(element)
			const children = element.childNodes
			while(children.length) {
				const child = children[children.length - 1]
				removeElement(child)
			}
		}
	}
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