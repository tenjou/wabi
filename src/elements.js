import {
	elementOpen as coreElementOpen,
	elementClose as coreElementClose,
	text as coreText,
	getNextNode
} from './core';
import { updateAttribute } from './attributes';
import {
	nextComponentStart,
	nextComponentEnd,
	getData
} from "./component";
import {
	assertNotInAttributes,
	assertNotInSkip,
	assertInAttributes,
	assertCloseMatchesOpenTag
} from './assertions';

const argsBuilder = [];

const elementOpen = function(tag, attributes, key, statics)
{
	if(process.env.NODE_ENV !== "production") {
		assertNotInAttributes("elementOpen");
		assertNotInSkip("elementOpen");
	}

	const node = coreElementOpen(tag, key)
	const data = getData(node)

	if(statics && !data.staticsApplied)
	{
		for(let key in statics) {
			updateAttribute(node, key, statics[key])
		}

		data.staticsApplied = true;
	}

	if(data.parentAttributes) {
		attributes = attributes ? Object.assign(attributes, data.parentAttributes) : data.parentAttributes
	}

	const prevAttributes = data.attributes

	// Remove attributes
	for(let key in prevAttributes) {
		if(!attributes[key]) {
			updateAttribute(node, key, undefined)
		}
	}

	// Update attributes
	for(let key in attributes) 
	{
		const value = attributes[key]

		if(!prevAttributes[key] || prevAttributes[key] !== value) {
			updateAttribute(node, key, value)
		}
	}

	data.attributes = attributes

	if(data.$value !== null) {
		text(data.$value)
	}

	return node
};

const elementClose = function(tag)
{
	if(process.env.NODE_ENV !== "production") {
		assertNotInAttributes("elementClose")
	}

	const node = coreElementClose()

	if(process.env.NODE_ENV !== "production") {
		assertCloseMatchesOpenTag(getData(node).nodeName, tag)
	}

	return node
};

const elementVoid = function(tag, attributes, key, statics) {
	elementOpen(tag, attributes, key, statics)
	return elementClose(tag)
}

const componentVoid = function(component, attributes, key)
{
	if(!component) {
		console.warn("Invalid component object passed")
		return
	}

	const node = getNextNode()
	let data = node ? node.metaData : null

	if(!data || data.constructor !== component) 
	{
		data = nextComponentStart(component)
		data.key = key

		if(attributes) 
		{
			data.parentAttributes = attributes

			for(let key in attributes)
			{
				if(key[0] === "$") 
				{
					const state = key.slice(1)

					if(data.$[state] === undefined) {
						console.log(`State '${state}' not defined for component:`, component)
						return
					}

					data[key] = attributes[key]
				}
			}
		}
		
		if(data.setup) {
			data.setup()
		}
	}

	data.render()
	nextComponentEnd()
}

const text = function(value, formatFunc)
{
	if(process.env.NODE_ENV !== "production") {
		assertNotInAttributes("text")
		assertNotInSkip("text")
	}

	const node = coreText()
	const data = getData(node)

	if(data.$.value !== value)
	{
		data.$.value = value

		if(formatFunc) {
			node.data = formatFunc(value)
		}
		else {
			node.data = value
		}
	}
}

export {
	elementOpen,
	elementClose,
	elementVoid,
	componentVoid,
	text
}
