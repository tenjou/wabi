import { getData, initData, haveNextComponent } from "./component";
import {
	assertInPatch,
	assertNoUnclosedTags,
	assertNotInAttributes,
	assertVirtualAttributesClosed,
	assertNoChildrenDeclaredYet,
	assertPatchElementNoExtras,
	setInAttributes,
	setInSkip
} from './assertions';
import { getFocusedPath, moveBefore } from './utils';
import { patchFunc, ready } from "./router";

let currentNode = null;
let currentParent = null;
let doc = null;

const patchFactory = function(run) {

	const f = function(node, fn, data) {
		const prevDoc = doc;
		const prevCurrentNode = currentNode;
		const prevCurrentParent = currentParent;
		let previousInAttributes = false;
		let previousInSkip = false;

		doc = node.ownerDocument;
		currentParent = node.parentNode;

		if (process.env.NODE_ENV !== 'production') {
			previousInAttributes = setInAttributes(false);
			previousInSkip = setInSkip(false);
		}

        const retVal = run(node, fn, data);

		if (process.env.NODE_ENV !== 'production') {
			assertVirtualAttributesClosed();
			setInAttributes(previousInAttributes);
			setInSkip(previousInSkip);
		}

		doc = prevDoc;
		currentNode = prevCurrentNode;
		currentParent = prevCurrentParent;

		return retVal;
	};
	return f;
};


const patchInner = patchFactory(function(node, fn, data) {

	if(!currentParent) {
		return null
	}

	currentNode = node

	enterNode()
	fn(data)
	exitNode()

	if(process.env.NODE_ENV !== 'production') {
		assertNoUnclosedTags(currentNode, node);
	}

	return node
});

patchFunc(patchInner)

/**
 * Patches an Element with the the provided function. Exactly one top level
 * element call should be made corresponding to `node`.
 * @param {!Element} node The Element where the patch should start.
 * @param {!function(T)} fn A function containing elementOpen/elementClose/etc.
 *     calls that describe the DOM. This should have at most one top level
 *     element call.
 * @param {T=} data An argument passed to fn to represent DOM state.
 * @return {?Node} The node if it was updated, its replacedment or null if it
 *     was removed.
 * @template T
 */
const patchOuter = patchFactory(function(node, fn, data) {
	let startNode = /** @type {!Element} */({ nextSibling: node });
	let expectedNextNode = null;
	let expectedPrevNode = null;

	if (process.env.NODE_ENV !== 'production') {
		expectedNextNode = node.nextSibling;
		expectedPrevNode = node.previousSibling;
	}

	currentNode = startNode;
	fn(data);

	if (process.env.NODE_ENV !== 'production') {
		assertPatchElementNoExtras(startNode, currentNode, expectedNextNode,
				expectedPrevNode);
	}

	if (node !== currentNode && node.parentNode) {
		removeChild(currentParent, node, getData(currentParent).keyMap);
	}

	return (startNode === currentNode) ? null : currentNode;
});


const matches = function(matchNode, nodeName, key) 
{
	if(haveNextComponent()) { return false }

	const data = getData(matchNode)

	// Key check is done using double equals as we want to treat a null key the
	// same as undefined. This should be okay as the only values allowed are
	// strings, null and undefined so the == semantics are not too weird.
	return nodeName === data.nodeName && key == data.key;
};


/**
 * Aligns the virtual Element definition with the actual DOM, moving the
 * corresponding DOM node to the correct location or creating it if necessary.
 * @param {string} nodeName For an Element, this should be a valid tag string.
 *     For a Text, this should be #text.
 * @param {?string=} key The key used to identify this element.
 */
const alignWithDOM = function(nodeName, key) {
	if (currentNode && matches(currentNode, nodeName, key)) {
		return;
	}

	const parentData = getData(currentParent);
	const currData = currentNode ? getData(currentNode) : null
	const keyMap = parentData.keyMap;
	let node;

	// Check to see if the node has moved within the parent.
	if(key)
	{
		const keyNode = keyMap[key];
		if (keyNode) {
			if (matches(keyNode, nodeName, key)) {
				node = keyNode;
			} else if (keyNode === currentNode) {
				context.markDeleted(keyNode);
			} else {
				removeChild(currentParent, keyNode, keyMap);
			}
		}
	}

	// Create the node if it doesn't exist.
	if(!node)
	{
		if (nodeName === '#text') {
			node = createText(doc);
		} else {
			node = createElement(doc, currentParent, nodeName, key);
		}

		if (key) {
			keyMap[key] = node;
		}
	}

	// Re-order the node into the right position, preserving focus if either
	// node or currentNode are focused by making sure that they are not detached
	// from the DOM.
	if (getData(node).focused) {
		// Move everything else before the node.
		moveBefore(currentParent, node, currentNode);
	} else if (currData && currData.key && !currData.focused) {
		// Remove the currentNode, which can always be added back since we hold a
		// reference through the keyMap. This prevents a large number of moves when
		// a keyed item is removed or moved backwards in the DOM.
		currentParent.replaceChild(node, currentNode);
		parentData.keyMapValid = false;
	} else {
		currentParent.insertBefore(node, currentNode);
	}

	currentNode = node;
};

const removeChild = function(node, child, keyMap)
{
	const childData = getData(child)

	childData.remove()
	node.removeChild(child)

	const children = child.childNodes
	for(let n = 0; n < children.length; n++) {
		removeData(children[n])
	}

	const key = childData.key
	if(key) {
		delete keyMap[key]
	}
}

const removeData = function(node) 
{
	node.metaData.remove()

	const children = node.childNodes
	for(let n = 0; n < children.length; n++) {
		removeData(children[n])
	}
}


/**
 * Clears out any unvisited Nodes, as the corresponding virtual element
 * functions were never called for them.
 */
const clearUnvisitedDOM = function() {
	const node = currentParent;
	const data = getData(node);
	const keyMap = data.keyMap;
	const keyMapValid = data.keyMapValid;
	let child = node.lastChild;
	let key;

	if (child === currentNode && keyMapValid) {
		return;
	}

	while (child !== currentNode) {
		removeChild(node, child, keyMap);
		child = node.lastChild;
	}

	// Clean the keyMap, removing any unusued keys.
	if (!keyMapValid) {
		for (key in keyMap) {
			child = keyMap[key];
			if (child.parentNode !== node) {
				context.markDeleted(child);
				delete keyMap[key];
			}
		}

		data.keyMapValid = true;
	}
};


/**
 * Changes to the first child of the current node.
 */
const enterNode = function() {
	currentParent = currentNode;
	currentNode = null;
};

const nextNode = function()
{
	if(currentNode) {
		currentNode = currentNode.nextSibling
	}
	else {
		currentNode = currentParent.firstChild
	}
}

const getNextNode = function()
{
	if(currentNode) {
		return currentNode.nextSibling
	}

	return currentParent.firstChild
}

/**
 * Changes to the parent of the current node, removing any unvisited children.
 */
const exitNode = function() {
	clearUnvisitedDOM();

	currentNode = currentParent;
	currentParent = currentParent.parentNode;
};

const elementOpen = function(tag, key) {
	nextNode()
	alignWithDOM(tag, key)
	enterNode()
	return currentParent
}

const elementClose = function()
{
	if(process.env.NODE_ENV !== "production") {
		setInSkip(false)
	}

	exitNode()
	return currentNode
}

const text = function() {
	nextNode()
	alignWithDOM("#text", null)
	return currentNode
}


/**
 * Gets the current Element being patched.
 * @return {!Element}
 */
const currentElement = function() {
	if (process.env.NODE_ENV !== 'production') {
		assertInPatch('currentElement', context);
		assertNotInAttributes('currentElement');
	}
	return /** @type {!Element} */(currentParent);
};


/**
 * @return {Node} The Node that will be evaluated for the next instruction.
 */
const currentPointer = function()
{
	if (process.env.NODE_ENV !== 'production') {
		assertInPatch('currentPointer', context);
		assertNotInAttributes('currentPointer');
	}

	if(currentNode) {
		return currentNode.nextSibling
	}

	return currentParent.firstChild
}


/**
 * Skips the children in a subtree, allowing an Element to be closed without
 * clearing out the children.
 */
const skip = function() {
	if (process.env.NODE_ENV !== 'production') {
		assertNoChildrenDeclaredYet('skip', currentNode);
		setInSkip(true);
	}
	currentNode = currentParent.lastChild;
};

const createElement = function(document, parent, tag, key) {
	const element = document.createElementNS("http://www.w3.org/1999/xhtml", tag)
	initData(element, tag, key)
	return element
}

const createText = function(doc) {
	const node = doc.createTextNode("")
	initData(node, "#text", null)
	return node
}

const selectElementContents = function(node)
{
	const range = doc.createRange()
	range.selectNodeContents(node)

	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
}

/**
 * Skips the next Node to be patched, moving the pointer forward to the next
 * sibling of the current pointer.
 */
const skipNode = nextNode;

/** */
export {
	elementOpen,
	elementClose,
	text,
	patchInner,
	patchOuter,
	currentElement,
	currentPointer,
	skip,
	skipNode,
	getNextNode,
	selectElementContents
};
