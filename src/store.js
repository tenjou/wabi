import { update } from "./router"

const tuple = {
	data: null,
	key: null
}

class Store
{
	constructor() {
		this.data = {}
		this.watchers = {}
	}

	set(key, value)
	{
		proxy({
			action: "SET",
			key,
			value
		})
	}

	add(key, value)
	{
		proxy({
			action: "ADD",
			key,
			value
		})
	}

	remove(key, value)
	{
		proxy({
			action: "REMOVE",
			key,
			value
		})
	}

	performSet(payload)
	{
		if(!this.getData(payload.key)) { return }

		if(!tuple.key) {
			this.data = payload.value
		}
		else {
			tuple.data[tuple.key] = payload.value
		}
		
		this.emit(payload);
	}

	performAdd(payload)
	{
		// const data = getData(payload.key);
		// if(!data) { return; }

		// const payloadData = payload.data;

		// for(let key in payloadData) {
		// 	data[key] = payloadData[key];
		// }

		// emit(payload, data);
	}

	performRemove(payload)
	{

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

	dispatch(data) {
		proxy(data)
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
			tuple.key = null;
			return tuple
		}

		const buffer = key.split(".")
		let data = this.data

		const num = buffer.length - 1;
		for(let n = 0; n < num; n++)
		{
			data = data[buffer[n]]
			if(!data) {
				return null
			}
		}

		tuple.data = data
		tuple.key = buffer[num]
		return tuple
	}

	toJSON() {
		return this.data
	}
}

const ProxyFunction = (payload) => {
	store.handle(payload)
}

const setProxy = (func) => {
	proxy = func || ProxyFunction
}

let proxy = ProxyFunction

const store = new Store()

export { 
	store, setProxy 
}
