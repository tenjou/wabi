
export class Watcher 
{
	constructor(owner, func) 
	{
		this.owner = owner ? owner : null,
		this.func = func;
	}
}

export class Data 
{
	constructor(raw, id, parent) 
	{
		this.watchers = null;
		this.parent = parent || null;
		this.refs = null;
		this.raw = raw || {};

		if(id !== undefined) {
			this.id = id;
		}
		else {
			this.id = "";
		}
	}

	set(key, value)
	{
		if(value === void(0)) 
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "set",
					value: key
				});
			} 
			else {
				this.performSet(key);
			}
		}
		else 
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "set",
					key: key,
					value: value
				});
			}
			else {
				this.performSetKey(key, value);
			}
		}
	}

	performSet(value) 
	{
		this.raw = value;

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "set", null, value, 0, this);
			}
		}
	}

	performSetKey(key, value) 
	{
		if(typeof value === "string") 
		{
			if(value[0] === "*") {
				var ref = new Reference(value, key, this);
				this.raw[key] = ref;
				return ref;
			}
		}

		var index = key.indexOf(".");
		if(index === -1) 
		{
			if(value instanceof Object && !(value instanceof Data)) {
				value = new Data(value, key, this);
			}

			this.raw[key] = value;
		}
		else
		{
			var id;
			var data = this;
			var buffer = key.split(".");
			for(var n = 0; n < buffer.length - 1; n++) 
			{
				id = buffer[n];

				var currData = data.get(id);
				if(!currData) {
					currData = new Data({}, id, data);
					data[id] = currData;
				}

				data = currData;
			}

			id = buffer[n];

			if(value instanceof Object && !(value instanceof Data)) {
				value = new Data(value, id, data);
			}

			data.raw[id] = value;
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "set", key, value, 0, this);
			}
		}

		return value;
	}

	setKeys(value)
	{
		if(wabi.dataProxy) 
		{
			wabi.dataProxy({ 
				id: this.genId(),
				type: "data",
				action: "setkeys",
				value: value
			});
		}
		else {
			this.performSetKeys(value);
		}
	}

	performSetKeys(value)
	{
		for(var key in value) {
			this.performSetKey(key, value[key]);
		}
	}

	add(key, value)
	{
		if(value === void(0)) 
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "add",
					value: key
				});
			}
			else {
				this.performAdd(key);
			}
		}
		else
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "add",
					key: key,
					value: value
				});
			}
			else {
				this.performAddKey(key, value);
			}
		}
	}

	push(key, value)
	{
		var buffer = this.get(key);
		if(!buffer) {
			buffer = new Data([], "content", this);
			this.raw[key] = buffer;
		}
		else
		{
			if(!(buffer.raw instanceof Array)) {
				console.warn(`(Wabi.Data.push) Key '${key}' is '${key}' not an Array`);
				return;
			}
		}

		buffer.add(value);
	}

	performAdd(value)
	{
		if(this.raw instanceof Array) 
		{
			if(value instanceof Object && !(value instanceof wabi.data)) {
				value = new Data(value, this.raw.length + "", this);
			}

			this.raw.push(value);
		}
		else 
		{
			console.warn("(Wabi.Data.performAdd) Can peform add only to Array");
			return;
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "add", null, value, -1, this);
			}
		}	
	}

	performAddKey(key, value)
	{
		if(this.raw instanceof Object) 
		{
			if(value instanceof Object && !(value instanceof Data)) {
				value = new Data(value, key, this);
			}
			else if(typeof value === "string" && value[0] === "*") {
				var ref = new Reference(value, key, this);
				this.raw[key] = value;
				value = ref;
			}	

			this.raw[key] = value;
		}
		else 
		{
			console.warn("(Wabi.Data.performAddKey) Can peform add only to Object");
			return;
		}	

		if(typeof value === "string" && value[0] === "*") {
			var ref = new Reference(value, key, this);
			this.raw[key] = value;
			value = ref;
		}	

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "add", key, value, -1, this);
			}
		}
	}

	remove(key)
	{
		// Remove self?
		if(key === undefined) {
			this.parent.remove(this.id);
		}
		else
		{
			if(wabi.dataProxy) 
			{
				wabi.dataProxy({ 
					id: this.genId(),
					type: "data",
					action: "remove",
					key: key
				});
			}
			else {
				this.performRemove(key);
			}
		}
	}

	performRemove(key)
	{
		var value = this.raw[key];
		delete this.raw[key];

		if(value instanceof Data)
		{
			var refs = value.refs;
			if(refs)
			{
				for(var n = 0; n < refs.length; n++) {
					refs[n].$remove();
				}

				value.refs = null;
			}
		}
		else if(value instanceof Reference) {
			value = value.instance;
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "remove", key, value, -1, this);
			}
		}	
	}

	removeItem(key, id)
	{
		var item = this.raw[key];
		if(typeof(item) !== "object") {
			return;
		}

		if(item instanceof Array) {
			item.splice(id, 1);
		}
		else {
			delete item[id];
		}

		if(this.watchers) 
		{
			var info;
			for(var n = 0; n < this.watchers.length; n++) {
				info = this.watchers[n];
				info.func.call(info.owner, "removeItem", key, null, id, this);
			}
		}
	}

	get(index) 
	{
		if(index === "*") {
			return new Data(this.raw, this.id, this.parent);
		}
		else if(index === "@") {
			return this.id;
		}

		var data;
		if(!isNaN(index) && index !== "") 
		{
			data = this.raw[index | 0];

			if(typeof(data) === "object" && !(data instanceof Data)) {
				data = new Data(data, index + "", this);
				this.raw[index] = data;
			}
		}
		else 
		{
			var cursor = index.indexOf(".");
			if(cursor === -1) 
			{
				data = this.raw[index];

				if(data)
				{
					if(typeof data === "object" && !(data instanceof Data)) {
						data = new Data(data, index + "", this);
						this.raw[index] = data;
					}
					else if(typeof data === "string" && data[0] === "*") {
						data = new Reference(data, index, this);
						this.raw[index] = data;
						return data;
					}
				}
			}
			else
			{
				var buffer = index.split(".");
				data = this;
				for(var n = 0; n < buffer.length; n++)
				{
					data = data.getItem(buffer[n]);
				}
			}
		}

		return data;
	}

	getItem(id)
	{
		if(id === "*") {
			return new Data(this.raw, this.id, this.parent);
		}

		var data;
		if(!isNaN(id) && id !== "") {
			data = this.raw[id | 0];
		}
		else 
		{
			data = this.raw[id];

			if(!data) {
				if(this.raw.content) {
					data = this.raw.content[id];
				}
			}
		}

		if(typeof(data) === "object" && !(data instanceof Data)) {
			data = new Data(data, id + "", this);
			this.raw[id] = data;
		}

		return data;
	}

	getFromKeys(keys)
	{
		var data = this;
		for(var n = 0; n < keys.length; n++) 
		{
			data = data.get(keys[n]);
			if(!data) {
				return null;
			}
		}

		return data;
	}

	genId()
	{
		if(!this.parent) { return this.id; }

		var id = this.id;
		var parent = this.parent;
		do 
		{
			if(!parent.id) { return id; }
			
			id = parent.id + "." + id;
			parent = parent.parent;
		} while(parent);

		return id;
	}

	watch(func, owner) 
	{
		if(!func) {
			console.warn("(Wabi.Data.watch) Invalid callback function passed");
			return;
		}
		if(!owner) {
			console.warn("(Wabi.Data.watch) Invalid owner passed");
			return;
		}

		if(this.watchers) {
			this.watchers.push(new Watcher(owner, func));
		}
		else {
			this.watchers = [ new Watcher(owner, func) ];
		}
	}

	unwatch(func, owner)
	{
		if(!this.watchers) { return; }

		var num = this.watchers.length;
		for(var n = 0; n < num; n++) 
		{
			var info = this.watchers[n];
			if(info.owner === owner && info.func === func) {
				this.watchers[n] = this.watchers[num - 1];
				this.watchers.pop();
				return;
			}
		}
	}

	sync() 
	{
		if(this.watchers) 
		{
			for(var n = 0; n < this.watchers.length; n++) {
				var info = this.watchers[n];
				info.func.call(info.owner, "sync", null, null, 0, this);
			}
		}	
	}

	__syncAsArray(data)
	{
		this.raw = data;

		if(this.watchers) 
		{
			for(var n = 0; n < this.watchers.length; n++) {
				var info = this.watchers[n];
				info.func.call(info.owner, "set", null, data, 0, this);
			}
		}	
	}

	__syncAsObject(data)
	{
		this.raw = {};

		for(var key in data)
		{
			var srcValue = this.raw[key];
			var targetValue = data[key];

			if(srcValue === void(0)) {
				this.raw[key] = targetValue;
			}
			else if(srcValue === targetValue) {
				srcValue = targetValue;
			}

			if(this.watchers) 
			{
				for(var n = 0; n < this.watchers.length; n++) {
					var info = this.watchers[n];
					info.func.call(info.owner, "set", key, targetValue, 0, this);
				}
			}
		}
	}

	removeRef(ref)
	{
		if(!this.refs) { 
			console.warn("(Wabi.Data.removeRef) No references created from this item");
			return;
		}

		var index = this.refs.indexOf(ref);
		this.refs[index] = this.refs[this.refs.length - 1];
		this.refs.pop();
	}

	toJSON() {
		return this.raw;
	}
}

class Reference
{
	constructor(path, id, parent) 
	{
		this.id = id;
		this.path = path;
		this.parent = parent;

		var refPath = path.slice(1);
		this.instance = wabi.globalData.raw.assets.get(refPath);

		if(this.instance)
		{
			if(this.instance.refs) {
				this.instance.refs.push(this);
			}
			else {
				this.instance.refs = [ this ];
			}
		}
		else {
			console.warn("(Wabi.Reference) Invalid path for reference: " + refPath);
		}
	}

	remove()
	{
		this.instance.removeRef(this);
		this.instance = null;
		this.parent.remove(this.id);
	}

	$remove() {
		this.parent.remove(this.id);
	}

	toJSON() {
		return this.path;
	}
}
