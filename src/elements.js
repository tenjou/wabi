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
	useNextComponentData,
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

	const node = coreElementOpen(tag, key);
	const data = getData(node);

	const nextComponentData = useNextComponentData()
	if(nextComponentData)
	{
		key = key ? key : nextComponentData.key

		if(nextComponentData.attributes) {
			attributes = attributes ? attributes.concat(nextComponentData.attributes) : nextComponentData.attributes
		}

		if(nextComponentData.statics) {
			statics = statics ? statics.concat(nextComponentData.statics) : nextComponentData.statics
		}
	}

	if(statics && !data.staticsApplied)
	{
		for(let n = 0; n < statics.length; n += 2) {
			const name = statics[n];
			const value = statics[n + 1];
			updateAttribute(node, name, value);
		}

		data.staticsApplied = true;
	}

	/*
	 * Checks to see if one or more attributes have changed for a given Element.
	 * When no attributes have changed, this is much faster than checking each
	 * individual argument. When attributes have changed, the overhead of this is
	 * minimal.
	 */

	const attrsArr = data.attrsArr;
	const newAttrs = data.newAttrs;
	const isNew = !attrsArr.length;
	let i = 0;
	let j = 0;

	const numArgs = attributes ? attributes.length : 0;

	for (; i < numArgs; i += 2, j += 2) {
	const attr = attributes[i];
	if (isNew) {
		attrsArr[j] = attr;
		newAttrs[attr] = undefined;
	} else if (attrsArr[j] !== attr) {
		break;
	}

	const value = attributes[i + 1];
	if (isNew || attrsArr[j + 1] !== value) {
		attrsArr[j + 1] = value;
		updateAttribute(node, attr, value);
	}
	}

	if (i < numArgs || j < attrsArr.length) {
	for (; i < numArgs; i += 1, j += 1) {
		attrsArr[j] = attributes[i];
	}

	if (j < attrsArr.length) {
		attrsArr.length = j;
	}

	/*
	 * Actually perform the attribute update.
	 */
	for (i = 0; i < attrsArr.length; i += 2) {
		const name = /** @type {string} */(attrsArr[i]);
		const value = attrsArr[i + 1];
		newAttrs[name] = value;
	}

	for (const attr in newAttrs) {
		updateAttribute(node, attr, newAttrs[attr]);
		newAttrs[attr] = undefined;
	}
	}

	if(data.$value !== null) {
		text(data.$value)
	}

	return node;
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

const componentVoid = function(component, attributes, key, statics)
{
	if(!component) {
		console.warn("Invalid component passed")
		return
	}

	const node = getNextNode()
	let data = node ? node.metaData : null

	if(!data || data.constructor !== component) {
		data = nextComponentStart(component, attributes, key, statics)
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

	if(data.text !== value)
	{
		data.text = value

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
