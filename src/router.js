
let _patchFunc = null
let _renderFunc = null
let dirty = false
let needUpdateRoute = false
let routes = []
let currRoute = null
let currRouteResult = []
let url = null

function Route(regexp, renderFunc, updateFunc) {
	this.regexp = new RegExp(regexp)
	this.renderFunc = renderFunc
	this.updateFunc = updateFunc
}

const patchFunc = function(func) {
	_patchFunc = func
}

const render = function()
{
	if(needUpdateRoute) {
		updateRoute()
	}

	if(dirty) 
	{
		if(currRoute && currRoute.renderFunc) 
		{
			if(_patchFunc(document.body, currRoute.renderFunc, currRouteResult)) {
				dirty = false
			}
		}
		else {
			dirty = false
		}
	}

	window.requestAnimationFrame(render)
}

const update = function() {
	dirty = true
}

const updateRoute = function() 
{
	url = document.location.pathname + document.location.hash
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
			currRoute = routeItem
			if(currRoute.updateFunc) {
				currRoute.updateFunc(currRouteResult)
			}
			break
		}
	}

	if(!currRoute) {
		console.warn("Could not found route for: " + url)
	}

	dirty = true
	needUpdateRoute = false
}

const route = function(regexp, renderFunc, updateFunc) {
	routes.push(new Route(regexp, renderFunc, updateFunc))
	needUpdateRoute = true
}

const clearRoutes = function() {
	routes.length = 0
	needUpdateRoute = true
}

window.addEventListener("hashchange", () => {
	updateRoute()
})

render()

export default {
	patchFunc,
	update,
	route,
	clearRoutes
}
