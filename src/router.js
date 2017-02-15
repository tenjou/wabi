
let _patchFunc = null
let _renderFunc = null
let dirty = false
let needUpdateRoute = false
let routes = []
let currRoute = null
let currRouteResult = null
let url = null

function Route(regexp, renderFunc) {
	this.regexp = new RegExp(regexp)
	this.renderFunc = renderFunc
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
		if(currRoute && currRoute.renderFunc) {
			_patchFunc(document.body, currRoute.renderFunc, currRouteResult)
		}

		dirty = false
	}

	window.requestAnimationFrame(render)
}

const update = function() {
	dirty = true
}

const updateRoute = function() 
{
	url = document.location.pathname + document.location.hash

	for(let n = 0; n < routes.length; n++)
	{
		const routeItem = routes[n]
		currRouteResult = routeItem.regexp.exec(url)
		if(currRouteResult) {
			currRoute = routeItem
			break
		}
	}

	if(!currRoute) {
		console.warn("Could not found route for: " + url)
	}

	dirty = true
	needUpdateRoute = false
}

const route = function(regexp, renderFunc) {
	routes.push(new Route(regexp, renderFunc))
	needUpdateRoute = true
}

window.addEventListener("hashchange", () => {
	updateRoute()
})

render()

export {
	patchFunc,
	update,
	route
}
