
let _patchFunc = null;
let _renderFunc = null;
let dirty = true;

function patchFunc(func) {
	_patchFunc = func;
}

function renderFunc(func) {
	_renderFunc = func;
	dirty = true;
}

function render() 
{
	if(dirty)
	{
		if(_renderFunc) {
			_patchFunc(document.body, _renderFunc);
		}

		dirty = false;
	}

	window.requestAnimationFrame(render)
}

function update() {
	dirty = true;
}

render();

export { 
	patchFunc, 
	renderFunc,
	update
}
