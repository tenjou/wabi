
let _patchFunc = null
let _renderFunc = null
let dirty = false
let routes = []

function Route(regexp, renderFunc) {
	this.regexp = regexp
	this.renderFunc = renderFunc
}

const patchFunc = function(func) {
	_patchFunc = func
}

const render = function() 
{
	if(dirty)
	{
		const pathname = document.location.pathname
		let foundRoute = false

		for(let n = 0; n < routes.length; n++) 
		{
			const routeItem = routes[n]
			if(pathname.match(routeItem.regexp)) 
			{
				foundRoute = true
				if(routeItem.renderFunc) {
					_patchFunc(document.body, routeItem.renderFunc)
					break
				}
			}
		}

		if(!foundRoute) {
			console.warn("Could not found route for: " + pathname)
		}

		dirty = false
	}

	window.requestAnimationFrame(render)
}

const update = function() {
	dirty = true
}

const route = function(regexp, renderFunc) {
	routes.push(new Route(regexp, renderFunc))
	dirty = true
}

render()

export { 
	patchFunc,
	update,
	route
}
