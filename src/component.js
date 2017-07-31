import { update } from "./renderer"
import { store } from "./store"

function WabiComponentInternal() 
{
	this.bindFuncs = {}
	this.vnode = null
	this.dirty = false

	const currState = {}
	for(let key in this.state) {
		currState[key] = this.state[key]
	}

	this.$ = currState
}

WabiComponentInternal.prototype = 
{
	_bind: null,
	mount: null,
	unmount: null,
	render: null,

	state: {
		value: null
	},

	remove() 
	{
		if(this.unmount) {
			this.unmount()
		}

		if(typeof this._bind === "string") {
			store.unwatch(this._bind, this.bindFuncs.value)
		}

		this.dirty = false		
	},

	handleAction(state, value) {
		this.$[state] = value
		update(this)
	},	

	setState(key, value) 
	{
		if(this.$[key] === value) { return }

		if(this._bind)
		{
			if(typeof this._bind === "string")
			{
				if(key === "value") {
					store.set(this._bind, value, true)
				}
				else {
					this.$[key] = value
					update(this)
				}
			}
			else
			{
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

	set bind(value)
	{
		const prevBind = this._bind

		if(prevBind)
		{
			if(value)
			{
				if(typeof prevBind === "string")
				{
					if(prevBind !== value) {
						const func = this.bindFuncs.value
						store.unwatch(prevBind, func)
						store.watch(value, func)
					}	
					
					this.$.value = store.get(value)
				}
				else
				{
					for(let key in prevBind)
					{
						const bindPath = value[key]
						if(prevBind[key] !== bindPath)
						{
							const func = this.bindFuncs[key]
							store.unwatch(prevBind[key], func)
							store.watch(bindPath, func)
						}

						this.$[key] = store.get(bindPath)
					}
				}
			}
			else
			{
				if(typeof prevBind === "string") {
					store.unwatch(prevBind, this.bindFuncs.value)
					this.$.value = this.state.value
				}
				else
				{
					for(let key in prevBind) {
						store.unwatch(prevBind[key], this.bindFuncs[key])
						this.bindFuncs[key] = undefined
						this.$[key] = this.state[key]
					}
				}
			}
		}
		else
		{
			if(typeof value === "string")
			{
				const func = (payload) => {
					this.handleAction("value", payload.value)
				}

				this.bindFuncs.value = func
				store.watch(value, func)
				this.$.value = store.get(value)
			}
			else
			{
				for(let key in value)
				{
					const bindValue = value[key]
					if(!bindValue) { continue }

					const func = (payload) => {
						this.handleAction(key, payload.value)
					}

					this.bindFuncs[key] = func
					store.watch(bindValue, func)
					this.$[key] = store.get(bindValue)
				}
			}
		}

		this._bind = value
		this.dirty = true
	},

	get bind() {
		return this._bind
	},

	updateAll()
	{
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

const component = function(componentProto) 
{
	function WabiComponent() {
		WabiComponentInternal.call(this)
	}

	const proto = Object.create(WabiComponentInternal.prototype)
	for(let key in componentProto)
	{
		const param = Object.getOwnPropertyDescriptor(componentProto, key)
		if(param.get || param.set) {
			Object.defineProperty(proto, key, param)
		}
		else {
			proto[key] = componentProto[key]
		}
	}

	const states = proto.state
	for(let key in states)
	{
		Object.defineProperty(proto, "$" + key,
		{
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