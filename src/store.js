import { update } from "./renderer"

function Proxy(key, func) {
	this.key = key
	this.func = func
}

function WatcherBuffer() {
	this.funcs = []
	this.buffer = null
}

class Store
{
	constructor() 
	{
		this.data = {}
		this.proxies = []
		this.emitting = false

		this.watchers = new WatcherBuffer()
		this.watchers.buffer = {}
	}

	set(key, value)
	{
		this.dispatch({
			action: "SET",
			key,
			value
		})
	}

	add(key, value)
	{
		this.dispatch({
			action: "ADD",
			key,	
			value
		})
	}

	remove(key, value)
	{
		this.dispatch({
			action: "REMOVE",
			key,
			value
		})
	}
	
	dispatch(data)
	{
		if(this.globalProxy) {
			this.globalProxy(data)
		}
		else {
			this.handle(data)
		}
	}

	performSet(payload)
	{
		const tuple = this.getData(payload.key)
		if(!tuple) { return }

		if(payload.key) 
		{
			tuple.data[tuple.key] = payload.value
			this.emit({
				action: "SET",
				key: tuple.parentKey,
				value: tuple.data
			}, tuple.watchers, "SET", tuple.key, payload.value)
		}
		else 
		{
			this.data = payload.value
			this.emitWatchers({
				action: "SET",
				key: "",
				value: payload.value
			}, this.watchers)
		}
	}

	performAdd(payload)
	{
		const tuple = this.getData(payload.key)
		if(!tuple) { return }

		let array = tuple.data[tuple.key]
		if(!array) {
			array = [ payload.value ]
			tuple.data[tuple.key] = array
		}
		else if(!Array.isArray(array)) {
			console.warn(`(store) Data at key '${payload.key}' is not an Array`)
			return
		}
		else {
			array.push(payload.value)
		}

		const funcs = tuple.watchers.funcs
		if(funcs) 
		{
			const payloadSet = {
				action: "SET",
				key: tuple.key,
				value: tuple.data
			}
			for(let n = 0; n < funcs.length; n++) {
				funcs[n](payloadSet)
			}

			const buffer = tuple.watchers.buffer
			if(buffer)
			{
				const watchers = buffer[tuple.key]
				if(watchers)
				{
					const funcs = watchers.funcs
					if(funcs) 
					{
						payloadSet.value = array
						for(let n = 0; n < funcs.length; n++) {
							funcs[n](payloadSet)
						}
					}
				}
			}
		}
	}

	performRemove(payload)
	{
		const tuple = this.getData(payload.key)
		if(!tuple) { return }

		const data = payload.value ? tuple.data[tuple.key] : tuple.data
		if(Array.isArray(data)) 
		{
			let index
			if(payload.value !== undefined) {
				index = data.indexOf(payload.value)
				if(index === -1) { return }
				data.splice(index, 1)
			}
			else {
				index = parseInt(tuple.key)
				data.splice(index, 1)
			}

			const payloadOut = {
				action: "SET",
				key: null,
				value: null
			}	

			if(payload.value)
			{
				payloadOut.key = tuple.key
				payloadOut.value = data
				
				const buffer = tuple.watchers.buffer[tuple.key]
				const funcs = buffer.funcs
				for(let n = 0; n < funcs.length; n++) {
					funcs[n](payloadOut)
				}
			}
			else
			{
				if(tuple.parentKey)
				{
					payloadOut.key = tuple.parentKey
					payloadOut.value = data		
	
					const watchers = tuple.watchers.funcs
					if(watchers) {
						for(let n = 0; n < watchers.length; n++) {
							watchers[n](payloadOut)
						}
					}
				}
	
				const buffer = tuple.watchers.buffer				
				for(let key in buffer) {
					const keyIndex = parseInt(key)
					if(keyIndex >= index && data.length > keyIndex) {
						payloadOut.key = key
						payloadOut.value = data[keyIndex]
						console.log(payloadOut.key, payloadOut.value)
						const funcs = buffer[key].funcs
						for(let n = 0; n < funcs.length; n++) {
							funcs[n](payloadOut)
						}
					}
				}
			}
		}
		else 
		{
			if(payload.value !== undefined) {
				delete data[payload.value]
				this.emitWatchers({
					action: "REMOVE",
					key: payload.value
				}, tuple.watchers.buffer[tuple.key])
				return			
			}
			else {
				delete data[tuple.key]
			}

			this.emit({
				action: "SET",
				key: tuple.parentKey,
				value: tuple.data
			}, tuple.watchers, "REMOVE", tuple.key, null)
		}
	}

	handle(data)
	{
		for(let n = 0; n < this.proxies.length; n++) {
			const proxy = this.proxies[n]
			if(data.key.indexOf(proxy.key) === 0) {
				if(proxy.func(data)) {
					return
				}
			}
		}

		switch(data.action) {
			case "SET": 
				this.performSet(data)
				break
			case "ADD":
				this.performAdd(data)
				break
			case "REMOVE":
				this.performRemove(data)
				break
		}
	}

	watch(path, func)
	{
		if(!path) { return }
		
		let watchers = this.watchers

		const keys = path.split("/")
		for(let n = 0; n < keys.length; n++) 
		{
			const key = keys[n]
			const buffer = watchers.buffer

			if(buffer) 
			{
				const nextWatchers = buffer[key]
				if(!nextWatchers) {
					const newWatchers = new WatcherBuffer()
					watchers.buffer[key] = newWatchers
					watchers = this.fillWatchers(newWatchers, keys, n + 1)
					break
				} 
				else {
					watchers = nextWatchers
				}
			}
			else {
				watchers = this.fillWatchers(watchers, keys, n)
				break
			}
		}

		watchers.funcs.push(func)
	}

	fillWatchers(watchers, keys, index)
	{
		for(let n = index; n < keys.length; n++) {
			const newWatcher = new WatcherBuffer()
			watchers.buffer = {}
			watchers.buffer[keys[n]] = newWatcher
			watchers = newWatcher
		}

		return watchers
	}

	// TODO: Remove empty watcher objects
	unwatch(path, func)
	{
		if(!path) { return }
		
		let watchers = this.watchers
		let prevWatchers = null

		const keys = path.split("/")
		for(let n = 0; n < keys.length; n++) {
			if(!watchers.buffer) {
				console.warn("(store.unwatch) Watcher can not be found for:", path)
				return
			}
			prevWatchers = watchers
			watchers = watchers.buffer[keys[n]]
			if(!watchers) { return }
		}

		const funcs = watchers.funcs
		const index = funcs.indexOf(func)
		if(index === -1) {
			console.warn("(store.unwatch) Watcher can not be found for:", path)
			return		
		}
	
		if(this.emitting) {
			funcs.splice(index, 1)
		}
		else {
			funcs[index] = funcs[funcs.length - 1]
			funcs.pop()
		}

		if(funcs.length === 0) {
			delete prevWatchers.buffer[keys[keys.length - 1]]
		}
	}

	emit(payload, watchers, action, key, value)
	{
		if(!watchers) { return }

		this.emitting = true

		const funcs = watchers.funcs
		if(funcs) {
			for(let n = 0; n < funcs.length; n++) {
				funcs[n](payload)
			}
		}

		watchers = watchers.buffer ? watchers.buffer[key] : null
		if(watchers) {
			payload.action = action
			payload.key = key
			payload.value = value
			this.emitWatchers(payload, watchers)
		}

		this.emitting = false
	}

	emitWatchers(payload, watchers)
	{
		const funcs = watchers.funcs
		if(funcs) {
			for(let n = 0; n < funcs.length; n++) {
				funcs[n](payload)
			}
		}

		const buffer = watchers.buffer
		if(buffer)
		{
			const value = payload.value
			if(value && typeof value === "object") {
				for(let key in buffer) {
					payload.key = key
					payload.value = (value[key] === undefined) ? null : value[key]
					this.emitWatchers(payload, buffer[key])
				}
			}
			else {
				payload.value = null
				for(let key in buffer) {
					payload.key = key
					this.emitWatchers(payload, buffer[key])
				}
			}
		}
	}

	get(key)
	{
		if(!key)
		{
			if(key === undefined) {
				return ""
			}

			return this.data
		}

		const buffer = key.split("/")
		let data = this.data

		for(let n = 0; n < buffer.length; n++)
		{
			const id = buffer[n]
			if(id === "@") {
				return buffer[n - 1]
			}
			else {
				data = data[id]
			}
			
			if(data === undefined) {
				return null
			}
		}

		return data
	}

	getData(path)
	{
		if(!path) {
			const tuple = {
				data: this.data,
				key: null,
				parentKey: null,
				watchers: null
			}
			return tuple
		}

		const keys = path.split("/")
		const num = keys.length - 1;
		if(num === 0) {
			const tuple = {
				data: this.data,
				key: keys[0],
				parentKey: null,
				watchers: this.watchers
			}
			return tuple
		}

		let data = this.data
		let watchers = this.watchers

		for(let n = 0; n < num; n++)
		{
			const key = keys[n]
			const newData = data[key]
			if(!newData) {
				console.warn(`(store.getData) No data available with key: [${keys[n]}] with path: [${path}]`)
				return null
			}

			data = newData
			if(watchers) {
				watchers = watchers.buffer ? watchers.buffer[key] : null
			}
		}

		const tuple = {
			data,
			key: keys[num],
			parentKey: keys[num - 1],
			watchers
		}

		return tuple
	}

	addProxy(key, func) 
	{
		if(key === "") 
		{
			if(this.globalProxy) {
				console.warn("(wabi.proxy) There is already global proxy declared")
				return
			}

			this.globalProxy = func
		}
		else 
		{
			for(let n = 0; n < this.proxies.length; n++) {
				const proxy = this.proxies[n]
				if(proxy.key === key && proxy.func === func) {
					console.warn("(wabi.proxy) There is already a proxy declared with key:", key)
					return
				}
			}
			
			const proxy = new Proxy(key, func)
			this.proxies.push(proxy)
		}
	}

	removeProxy(key, func)
	{
		if(key === "") 
		{
			if(this.globalProxy !== func) {
				console.warn("(wabi.proxy) Global proxy functions don`t match")
				return
			}

			this.globalProxy = null
		}
		else 
		{
			for(let n = 0; n < this.proxies.length; n++) {
				const proxy = this.proxies[n]
				if(proxy.key === key && proxy.func === func) {
					this.proxies[n] = this.proxies[this.proxies.length - 1]
					this.proxies.pop()
					return
				}
			}
		}
	}

	toJSON() {
		return this.data
	}
}

const store = new Store()

const lastSegment = function(str)
{
	const index = str.lastIndexOf("/")
	if(index === -1) { return null }

	return str.slice(index + 1)
}

export {
	store, lastSegment
}
