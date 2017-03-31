import { update } from "./router"

const tuple = {
	data: null,
	key: null,
	parentKey: null
}

class Store
{
	constructor() {
		this.data = {}
		this.watchers = {}
		this.proxies = {}
	}

	set(key, value, force)
	{
		this.dispatch({
			action: "SET",
			key,
			value,
			force
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
			key
		})
	}

	create(key, value)
	{
		this.dispatch({
			action: "CREATE",
			key,
			value
		})
	}

	dispatch(data)
	{
		const globalProxy = this.proxies[""]

		const index = data.key.indexOf(".")
		const proxy = (index === -1) ?
						this.proxies[data.key] :
						this.proxies[data.key.slice(0, index)]
		if(proxy)
		{
			if(globalProxy) {
				globalProxy(data)
			}
			proxy(data)
		}
		else
		{
			if(globalProxy) {
				globalProxy(data)
			}
			else {
				this.handle(data)
			}
		}
	}

	performSet(payload)
	{
		if(!this.getData(payload.key, payload.force)) { return }

		if(!tuple.key)
		{
			this.data = payload.value

			for(let key in this.watchers)
			{
				const value = this.get(key)

				const emitPayload = {
					action: "SET",
					key: key,
					value: value
				}
				this.emit(emitPayload)
			}
		}
		else
		{
			tuple.data[tuple.key] = payload.value
			this.emit(payload)

			if(tuple.parentKey)
			{
				const emitPayload = {
					action: payload.action,
					key: tuple.parentKey,
					value: tuple.data
				}
				this.emit(emitPayload)
			}
		}
	}

	performAdd(payload)
	{
		if(!this.getData(payload.key)) { return }

		let array = tuple.data[tuple.key]
		if(!array) {
			array = [ payload.value ]
			tuple.data[tuple.key] = array
		}
		else if(!Array.isArray(array)) {
			console.warn("(store) Data at key '${payload.key}' is not an Array")
			return
		}
		else {
			array.push(payload.value)
		}

		const emitPayload = {
			action: payload.action,
			key: tuple.key,
			value: array
		}
		this.emit(emitPayload)
	}

	performRemove(payload)
	{
		if(!this.getData(payload.key)) { return }

		const data = tuple.data
		if(Array.isArray(data)) {
			data.splice(parseInt(tuple.key), 1)
		}
		else {
			delete data[tuple.key]
		}

		const emitPayload = {
			action: payload.action,
			key: tuple.parentKey,
			value: data
		}
		this.emit(emitPayload)
	}

	performCreate(payload)
	{
		if(!this.getData(payload.key, true)) { return }

		if(!tuple.data[tuple.key]) {
			tuple.data[tuple.key] = payload.value
		}
		
		// if(tuple.parentKey)
		// {
		// 	const emitPayload = {
		// 		action: payload.action,
		// 		key: tuple.parentKey,
		// 		value: tuple.data
		// 	}
		// 	this.emit(emitPayload)
		// }
	}

	handle(data)
	{
		switch(data.action)
		{
			case "SET":
				this.performSet(data)
				break

			case "ADD":
				this.performAdd(data)
				break

			case "REMOVE":
				this.performRemove(data)
				break

			case "CREATE":
				this.performCreate(data)
				break
		}
	}

	watch(key, element)
	{
		const buffer = this.watchers[key]
		if(!buffer) {
			this.watchers[key] = [ element ]
		}
		else {
			buffer.push(element)
		}
	}

	unwatch(key, element)
	{
		const buffer = this.watchers[key]
		if(!buffer) { return }

		for(let n = 0; n < buffer.length; n++)
		{
			if(buffer[n] === element) {
				buffer[n] = buffer[buffer.length - 1]
				buffer.pop()
				break
			}
		}

		if(buffer.length === 0) {
			delete this.watchers[key]
		}
	}

	emit(payload)
	{
		const buffer = this.watchers[payload.key]
		if(!buffer) { return }

		for(let n = 0; n < buffer.length; n++) {
			buffer[n](payload)
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

		const buffer = key.split(".")
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

	getData(key, force)
	{
		if(!key) {
			tuple.data = this.data
			tuple.key = null
			tuple.parentKey = null
			return tuple
		}

		const buffer = key.split(".")
		let data = this.data

		const num = buffer.length - 1;
		if(num === 0)
		{
			tuple.data = data
			tuple.key = buffer[0]
			tuple.parentKey = null
		}
		else
		{
			for(let n = 0; n < num; n++)
			{
				const newData = data[buffer[n]]
				if(!newData)
				{
					if(!force) {
						console.warn(`(store.getData) No data available with key: [${buffer[n]}] in address: [${key}]`)
						return null
					}
					else
					{
						for(; n < num; n++) {
							const newDict = {}
							data[buffer[n]] = newDict
							data = newDict
						}
						break
					}

				}

				data = newData
			}

			tuple.data = data
			tuple.key = buffer[num]
			tuple.parentKey = key.slice(0, key.lastIndexOf("."))
		}

		return tuple
	}

	proxy(key, func) {
		this.proxies[key] = func
	}

	toJSON() {
		return this.data
	}
}

const store = new Store()

const lastSegment = function(str)
{
	const index = str.lastIndexOf(".")
	if(index === -1) { return null }

	return str.slice(index + 1)
}

export {
	store, lastSegment
}
