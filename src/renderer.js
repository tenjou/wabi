import { render, renderInstance, removeAll } from "./dom"

const updateBuffer = []
const routes = []
let needUpdate = false
let needUpdateRoute = false
let currRouteResult = []
let currRoute = null
let url = null

function Route(regexp, component, enterFunc, exitFunc, readyFunc) {
	this.regexp = regexp
	this.component = component
	this.enterFunc = enterFunc || null
	this.exitFunc = exitFunc || null
	this.readyFunc = readyFunc || null
}

const update = (component) => {
	if(component._dirty) { return }
	component._dirty = true

	updateBuffer.push(component)
	needUpdate = true
}

const renderLoop = () => {
	if(needUpdate) {
		updateRender()
	}
	if(needUpdateRoute) {
		updateRoute()
	}
	window.requestAnimationFrame(renderLoop)
}

const updateRender = () => {
	updateBuffer.sort(sortByDepth)

	for(let n = 0; n < updateBuffer.length; n++) {
		const node = updateBuffer[n]
		if(!node._dirty) { 
			continue 
		}
		renderInstance(node)
	}

	updateBuffer.length = 0
	needUpdate = false	
}

const sortByDepth = (a, b) => {
	return a.depth - b.depth
}

const route = (regexp, component, enterFunc, exitFunc, readyFunc) => {
	routes.push(new Route(regexp, component, enterFunc, exitFunc, readyFunc))
	needUpdateRoute = true
}

const updateRoute = () => {
	needUpdateRoute = false

	currRouteResult.length = 0
	url = (document.location.protocol === "file:") ?
		"/" + document.location.hash :
		document.location.pathname + document.location.hash

	let result
	for(let n = 0; n < routes.length; n++) {
		const routeItem = routes[n]

		if(routeItem.regexp) {
			const regex = new RegExp(routeItem.regexp, "g")
			while(result = regex.exec(url)) {
				currRouteResult.push(result)
			}
			if(currRouteResult.length === 0) { 
				continue 
			}
		}

		if(currRoute && currRoute.exitFunc) {
			currRoute.exitFunc()
		}

		currRoute = routeItem
		
		let props = null
		if(currRoute.enterFunc) {
			props = currRoute.enterFunc(currRouteResult)
		}

		render(currRoute.component, document.body, props)
		break
	}

	if(!currRoute) {
		console.warn("Could not found route for: " + url)
	}
	else if(currRoute.readyFunc) {
		currRoute.readyFunc()
	}
}

const clearRoutes = function(remove) {
	routes.length = 0
	currRoute = null

	if(remove) {
		removeAll()
	}
}

const onDomLoad = () => {
	if((document.readyState === "interactive" || document.readyState === "complete")) {
		renderLoop()
		return
	}

	const callbackFunc = (event) => {
		renderLoop()
		window.removeEventListener("DOMContentLoaded", callbackFunc)
	}

	window.addEventListener("DOMContentLoaded", callbackFunc)
}

window.addEventListener("hashchange", () => {
	updateRoute()
})

onDomLoad(renderLoop)

export { 
	update,
	route,
	clearRoutes
}