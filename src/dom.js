Node.prototype.__props = null
Node.prototype.__component = null

const namespaceSVG = "http://www.w3.org/2000/svg"
const stack = new Array(128)
const indices = new Array(128)
const components = {}
let stackIndex = 0

const elementOpen = (type, props = null, srcElement = null) => {
	const parentElement = stack[stackIndex]
	const index = indices[stackIndex]
	const prevElement = parentElement.childNodes[index]
	let element = null

	if(!prevElement) {
		if(srcElement) {
			element = srcElement
		}
		else {
			const namespace = (type === "svg") ? namespaceSVG : parentElement.namespaceURI
			element = document.createElementNS(namespace, type)
		}

		if(props) {
			for(let key in props) {
				setProp(element, key, props[key])
			}
			element.__props = props
		}

		parentElement.appendChild(element)
	}
	else {
		if(prevElement.nodeType === 3 || prevElement.localName !== type) {
			if(srcElement) {
				element = srcElement
			}
			else {
				const namespace = (type === "svg") ? namespaceSVG : parentElement.namespaceURI
				element = document.createElementNS(namespace, type)
			}

			const component = prevElement.__component
			if(component) {
				parentElement.replaceChild(element, component._base)
				removeComponentExt(prevElement, parentElement)
			}
			else {
				parentElement.replaceChild(element, prevElement)
			}

			if(props) {
				for(let key in props) {
					setProp(element, key, props[key])
				}
				prevElement.__props = props
			}
		}
		else {
			element = prevElement

			const prevProps = element.__props
			if(props !== prevProps) {
				if(props) {
					if(prevProps) {
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
					else {
						for(let key in props) {
							setProp(element, key, props[key])
						}	
					}

					element.__props = props
				}
				else {
					if(prevProps) {
						for(let key in prevProps) {
							unsetProp(element, key)
						}

						element.__props = null
					}				
				}
			}
		}
	}

	stackIndex++
	stack[stackIndex] = element
	indices[stackIndex] = 0

	return element
}

const elementClose = (type) => {
	const element = stack[stackIndex]
	if(element.localName !== type) {
		console.error(`(Element.close) Unexpected element closed: ${type} but was expecting: ${node.localName}`)
	}

	const index = indices[stackIndex]
	if(index < element.childNodes.length) {
		removeRange(element, index - 1, element.childNodes.length - 1)
	}

	indices[stackIndex] = 0
	stackIndex--
	indices[stackIndex]++
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

const componentVoid = (ctor, props = null) => {
	const parentElement = stack[stackIndex]
	const index = indices[stackIndex]
	let element = parentElement.childNodes[index]
	let mounted = true
	let component = null

	if(element) {
		component = element.__component
		if(component) {
			if(component.constructor === ctor) {
				diffComponentProps(component, props)
				mounted = false
			}
			else {
				const newComponent = createComponent(ctor)
				parentElement.replaceChild(newComponent._base, component._base)
				removeComponentExt(element, parentElement)
				component = newComponent
				diffComponentProps(component, props)
			}	
		}
		else {
			component = createComponent(ctor)
			parentElement.replaceChild(component._base, element)
			removeNode(element)
			diffComponentProps(component, props)			
		}
	}
	else {
		component = createComponent(ctor)
		parentElement.appendChild(component._base)	
		diffComponentProps(component, props)	
	}

	if(mounted && component.mounted) {
		component.mounted()
	}

	const prevChildrenCount = component._numChildren

	indices[stackIndex]++
	component._index = index + 1
	component._depth = stackIndex
	component.render()
	component._dirty = false
	component._numChildren = indices[stackIndex] - component._index
	if(component._numChildren < prevChildrenCount) {
		removeRange(component._base, prevChildrenCount, component._numChildren)
	}

	return component
}

const diffComponentProps = (component, props) => {
	const prevProps = component._base.__props
	if(props !== prevProps) {
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

			component._base.__props = props
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

			component._base.__props = null
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
	component._dirty = true
	return component
}

const text = (text) => {
	const parentElement = stack[stackIndex]
	const index = indices[stackIndex]
	const prevElement = parentElement.childNodes[index]
	let element = null

	if(prevElement) {
		if(prevElement.nodeType === 3) {
			element = prevElement
			if(prevElement.nodeValue !== text) {
				prevElement.nodeValue = text
			}
		}
		else {
			element = document.createTextNode(text)
			const component = prevElement.__component
			if(component) {			
				prevElement.replaceChild(element, component._base)
				removeComponentExt(prevElement, parentElement)
			}
			else {
				parentElement.replaceChild(element, prevElement)
				removeRange(prevElement, 0, prevElement.childNodes.length - 1)
			}
		}
	}
	else {
		element = document.createTextNode(text)
		parentElement.appendChild(element)
	}

	indices[stackIndex]++

	return element
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
	stackIndex = 0
	stack[0] = parentElement
	indices[0] = 0

	componentVoid(component, props)
}

const renderInstance = (component) => {
	const prevChildrenCount = component._numChildren

	stackIndex = component._depth
	stack[stackIndex] = component._base.parentElement
	indices[stackIndex] = component._index

	component.render()
	component._dirty = false
	component._numChildren = indices[stackIndex] - component._index
	if(component._numChildren < prevChildrenCount) {
		removeRange(component._base.parentElement, component._index - 1, component._index + component._numChildren)
	}

	indices[stackIndex] = 0
}

const removeRange = (parentElement, indexStart, indexEnd) => {
	const children = parentElement.childNodes
	for(let n = indexEnd; n > indexStart; n--) {
		const child = children[n]
		removeNode(child, parentElement)
		child.remove()
	}
}

const removeNode = (element) => {
	if(element.__component) {
		removeComponent(element)
	}
	else {
		const children = element.childNodes
		for(let n = 0; n < children.length; n++) {
			removeNode(children[n])
		}
	}
}

const removeComponent = (element) => {
	const component = element.__component
	const buffer = components[component.__componentIndex]
	if(buffer) {
		buffer.push(component)
	}
	else {
		components[component.__componentIndex] = [ component ]
	}

	const props = element.__props
	if(props) {
		for(let key in props) {
			component[key] = null
		}
		element.__props = null
	}

	component.remove()
}

const removeComponentExt = (element, parentElement) => {
	const component = element.__component
	const buffer = components[component.__componentIndex]
	if(buffer) {
		buffer.push(component)
	}
	else {
		components[component.__componentIndex] = [ component ]
	}

	const props = element.__props
	if(props) {
		for(let key in props) {
			component[key] = null
		}
		element.__props = null
	}

	const children = parentElement.childNodes
	const indexStart = component._index - 1
	const indexEnd = component._index + component._numChildren - 1
	for(let n = indexEnd; n > indexStart; n--) {
		const child = children[n]
		if(child.__component) {
			removeComponent(child)
		}
		else {
			const childChildren = child.childNodes
			for(let n = 0; n < childChildren.length; n++) {
				removeNode(childChildren[n])
			}
		}
		child.remove()
	}

	component.remove()
}

const removeAll = () => {
	removeRange(document.body, 0, document.body.childNodes.length - 1)
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