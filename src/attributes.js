import { getData } from "./component"

const applyAttr = function(element, name, value) 
{
	if(value == null) {
		element.removeAttribute(name)
	} 
	else {
		element.setAttribute(name, value)
	}
}

const applyProp = function(el, name, value) {
  el[name] = value;
};

/**
 * Applies a value to a style declaration. Supports CSS custom properties by
 * setting properties containing a dash using CSSStyleDeclaration.setProperty.
 * @param {CSSStyleDeclaration} style
 * @param {!string} prop
 * @param {*} value
 */
const setStyleValue = function(style, prop, value) {
  if (prop.indexOf('-') >= 0) {
	style.setProperty(prop, /** @type {string} */(value));
  } else {
	style[prop] = value;
  }
};


/**
 * Applies a style to an Element. No vendor prefix expansion is done for
 * property names/values.
 * @param {!Element} el
 * @param {string} name The attribute's name.
 * @param {*} style The style to set. Either a string of css or an object
 *     containing property-value pairs.
 */
function applyStyle(el, name, style)
{
  if (typeof style === 'string') {
	el.style.cssText = style;
  } else {
	el.style.cssText = '';
	const elStyle = el.style;
	const obj = style;

	for (const prop in obj) {
	  if (Object.prototype.hasOwnProperty.call(obj, prop)) {
		setStyleValue(elStyle, prop, obj[prop]);
	  }
	}
  }
};

function applyBind(element, name, value) {
  element.metaData.bind = value;
}

/**
 * Updates a single attribute on an Element.
 * @param {!Element} el
 * @param {string} name The attribute's name.
 * @param {*} value The attribute's value. If the value is an object or
 *     function it is set on the Element, otherwise, it is set as an HTML
 *     attribute.
 */
const applyAttributeTyped = function(el, name, value) {
  const type = typeof value;

  if (type === 'object' || type === 'function') {
	applyProp(el, name, value);
  } else {
	applyAttr(el, name, /** @type {?(boolean|number|string)} */(value));
  }
};


function updateAttribute(element, name, value)
{
	const data = getData(element)
	const attrs = data.attributes
	const firstChar = name[0]

	if(firstChar === "$")
	{
		const state = name.slice(1)
		
		if(data.$[state] === undefined) {
			console.log(`State '${state}' not defined for element:`, element)
			return
		}

		data[name] = (value === undefined) ? data.state[state] : value
	}
	else
	{
		const mutator = attributes[name] || applyAttributeTyped
		mutator(element, name, value)
	}
}

const attributes = Object.create(null)
attributes.style = applyStyle
attributes.bind = applyBind

export {
	updateAttribute,
	applyProp,
	applyAttr
}
