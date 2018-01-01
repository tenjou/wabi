import { getBodyNode } from "./dom"

let tabs = ""

const dump = (node) => {
	console.log("---")
	dumpNode(node)
	console.log("\n")
}

const dumpNode = (node) => 
{
	const tag = node.component ? "component" : node.type
	
	const children = node.children
	if(children.length > 0) {
		dumpOpen(tag)
		for(let n = 0; n < children.length; n++) {
			dumpNode(children[n])
		}
		dumpClose(tag)
	}
	else {
		dumpVoid(tag)
	}
}

const dumpOpen = (name) => {
	console.log(`${tabs}<${name}>`)
	incTabs()
}

const dumpClose = (name) => {
	decTabs()
	console.log(`${tabs}</${name}>`)
}

const dumpVoid = (name) => {
	console.log(`${tabs}<${name}></${name}>`)
}

const incTabs = () => {
	tabs += "\t"
}

const decTabs = () => {
	tabs = tabs.substring(0, tabs.length - 1)
}

export default dump