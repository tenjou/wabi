
const selectElementContents = (node) => {
	const range = document.createRange()
	range.selectNodeContents(node)

	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
}

export {
	selectElementContents
}