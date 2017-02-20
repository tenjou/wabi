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
			key
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
		if(!this.getData(payload.key)) { return }

		if(!tuple.key) {
			this.data = payload.value
			// TODO: loop through and check if there are watchers.
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

	handle(data)
	{
		switch(data.action)
		{
			case "SET":
				this.performSet(data)
				break;

			case "ADD":
				this.performAdd(data)
				break;

			case "REMOVE":
				this.performRemove(data)
				break;
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
			buffer[n].handleAction(payload)
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
			data = data[buffer[n]]
			if(!data) {
				return null
			}
		}

		return data
	}

	getData(key)
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
					for(; n < num; n++) {
						const newDict = {}
						data[buffer[n]] = newDict
						data = newDict
					}
					break
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
