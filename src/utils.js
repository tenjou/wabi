
const lastSegment = (str) =>
{
	const index = str.lastIndexOf(".")
	if(index === -1) { return null }

	return str.slice(index + 1)
}

const selectElementContents = (node) =>
{
	const range = document.createRange()
	range.selectNodeContents(node)

	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
}

export {
	lastSegment,
	selectElementContents
}