import { VNode } from "./vnode"
import { render, renderInstance } from "./dom"

const updateBuffer = []
const routes = []
let needUpdate = false
let needUpdateRoute = false
let currRouteResult = []
let currRoute = null
let url = null

function Route(regexp, component, enterFunc, exitFunc) {
	this.regexp = new RegExp(regexp)
	this.component = component
	this.enterFunc = enterFunc || null
	this.exitFunc = exitFunc || null
}

const update = function(instance)
{
	if(instance.dirty) { return }
	instance.dirty = true

	updateBuffer.push(instance)
	needUpdate = true
}

const renderLoop = function()
{
	if(needUpdate)
	{
		updateBuffer.sort(sortByDepth)

		for(let n = 0; n < updateBuffer.length; n++) 
		{
			const node = updateBuffer[n]
			if(!node.dirty) { continue }
			
			renderInstance(node)
		}

		updateBuffer.length = 0
		needUpdate = false
	}

	if(needUpdateRoute) {
		updateRoute()
	}

	window.requestAnimationFrame(renderLoop)
}

const sortByDepth = function(a, b) {
	return a.depth - b.depth
}

const route = function(regexp, renderFunc, enterFunc, exitFunc) {
	routes.push(new Route(regexp, renderFunc, enterFunc, exitFunc))
	needUpdateRoute = true
}

const updateRoute = function() 
{
	url = document.location.hash
	if(!url) {
		url = "/"
	}
	currRouteResult.length = 0

	let result
	for(let n = 0; n < routes.length; n++)
	{
		const routeItem = routes[n]
		const regex = new RegExp(routeItem.regexp, "g")
		while(result = regex.exec(url)) {
			currRouteResult.push(result)
		}

		if(currRouteResult.length > 0)
		{
			if(currRoute === routeItem) { break }

			if(currRoute && currRoute.exitFunc) {
				currRoute.exitFunc()
			}

			currRoute = routeItem
			
			if(currRoute.enterFunc) {
				currRoute.enterFunc(currRouteResult)
			}

			updateBuffer.length = 0
			render(currRoute.component, document.body)
			break
		}
	}

	if(!currRoute) {
		console.warn("Could not found route for: " + url)
	}

	needUpdateRoute = false
}

const clearRoutes = function() {
	routes.length = 0
	currRoute = null
	render(null, document.body)
}

window.addEventListener("hashchange", () => {
	updateRoute()
})

renderLoop()

export { 
	update,
	route,
	clearRoutes
}