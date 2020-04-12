import { update } from "./renderer"
import { store } from "./store"

let componentIndex = 0

function WabiComponentInternal() {
	this._bindFuncs = {}
	this._dirty = false
	this._depth = -1
	this._numChildren = 0
	this._base = document.createTextNode("")
	this._base.__component = this

	const currState = {}
	for(let key in this.state) {
		currState[key] = this.state[key]
	}

	this.$ = currState
}

WabiComponentInternal.prototype = {
	_bind: null,
	mount: null,
	mounted: null,
	unmount: null,
	render: null,

	state: {
		value: null
	},

	remove() {
		if(this.unmount) {
			this.unmount()
		}

		this.reset()
	},

	reset() {
		if(typeof this._bind === "string") {
			store.unwatch(this._bind, this._bindFuncs.value)
		}
		else {
			for(let key in this._bind) {
				store.unwatch(this._bind[key], this._bindFuncs[key])
			}
		}

		this._bind = null
		this._dirty = false	
		this._depth = -1
		this._numChildren = 0
		const currState = this.$
		const initState = this.state
		for(let key in currState) {
			currState[key] = initState[key]
		}		
	},

	handleAction(state, value) {
		this.$[state] = value
		update(this)
	},	

	setState(key, value) {
		if(this.$[key] === value) { 
			return 
		}

		if(this._bind) {
			if(typeof this._bind === "string") {
				if(key === "value") {
					store.set(this._bind, value, true)
				}
				else {
					this.$[key] = value
					update(this)
				}
			}
			else {
				const binding = this._bind[key]
				if(binding) {
					store.set(binding, value, true)
				}
				else {
					this.$[key] = value
					update(this)
				}
			}
		}
		else {
			this.$[key] = value
			update(this)
		}
	},

	set bind(value) {
		const prevBind = this._bind
		if(prevBind) {
			if(value) {
				if(typeof prevBind === "string") {
					if(prevBind !== value) {
						const func = this._bindFuncs.value
						store.unwatch(prevBind, func)
						store.watch(value, func)
					}	
					
					this.$.value = store.get(value)
				}
				else {
					for(let key in prevBind) {
						if(value[key] === undefined) {
							const func = this._bindFuncs[key]
							store.unwatch(prevBind[key], func)
							this._bindFuncs[key] = undefined
						}
					}

					for(let key in value) {
						const bindPath = value[key]
						if(prevBind[key] !== bindPath) {
							let func = this._bindFuncs[key]
							if(!func) {
								func = (payload) => {
									this.handleAction(key, payload.value)
								}
								this._bindFuncs[key] = func
							}
							store.unwatch(prevBind[key], func)
							store.watch(bindPath, func)
							this.$[key] = store.get(bindPath)
						}
					}
				}
			}
			else {
				if(typeof prevBind === "string") {
					store.unwatch(prevBind, this._bindFuncs.value)
					this.$.value = this.state.value
				}
				else {
					for(let key in prevBind) {
						store.unwatch(prevBind[key], this._bindFuncs[key])
						this._bindFuncs[key] = undefined
						this.$[key] = this.state[key]
					}
				}
			}
		}
		else {
			if(typeof value === "string") {
				const func = (payload) => {
					this.handleAction("value", payload.value)
				}

				this._bindFuncs.value = func
				store.watch(value, func)
				this.$.value = store.get(value)
			}
			else {
				for(let key in value) {
					const bindValue = value[key]
					if(!bindValue) { 
						continue 
					}
					const func = (payload) => {
						this.handleAction(key, payload.value)
					}
					this._bindFuncs[key] = func
					store.watch(bindValue, func)
					this.$[key] = store.get(bindValue)
				}
			}
		}

		this._bind = value
		this._dirty = true
	},

	get bind() {
		return this._bind
	},

	updateAll() {
		update(this)

		const children = this.vnode.children
		for(let n = 0; n < children.length; n++) {
			const child = children[n]
			if(child.component) {
				update(child.component)
			}
		}
	}
}

const component = (componentProto) => {
	function WabiComponent() {
		WabiComponentInternal.call(this)
	}

	const proto = Object.create(WabiComponentInternal.prototype)
	for(let key in componentProto) {
		const param = Object.getOwnPropertyDescriptor(componentProto, key)
		if(param.get || param.set) {
			Object.defineProperty(proto, key, param)
		}
		else {
			proto[key] = componentProto[key]
		}
	}

	proto.__componentIndex = componentIndex++

	const states = proto.state
	for(let key in states) {
		Object.defineProperty(proto, "$" + key, {
			set(value) {
				this.setState(key, value)
			},
			get() {
				return this.$[key]
			}
		})
	}

	WabiComponent.prototype = proto
	WabiComponent.prototype.constructor = WabiComponent
	return WabiComponent
}

export { component }