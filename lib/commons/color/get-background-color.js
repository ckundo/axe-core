/*global dom, color */
/* jshint maxstatements: 21, maxcomplexity: 13 */
//TODO dsturley: too complex, needs refactor!!

/**
 * Returns the non-alpha-blended background color of a node, null if it's an image
 * @param {Element} node
 * @return {Color}
 */
function getBackgroundForSingleNode(node) {
	var bgColor,
		nodeStyle = window.getComputedStyle(node);

	if (nodeStyle.getPropertyValue('background-image') !== 'none') {
		return null;
	}

	var bgColorString = nodeStyle.getPropertyValue('background-color');
	//Firefox exposes unspecified background as 'transparent' rather than rgba(0,0,0,0)
	if (bgColorString === 'transparent') {
		bgColor = new color.Color(0, 0, 0, 0);
	} else {
		bgColor = new color.Color();
		bgColor.parseRgbString(bgColorString);
	}
	var opacity = nodeStyle.getPropertyValue('opacity');
	bgColor.alpha = bgColor.alpha * opacity;

	return bgColor;
}

/**
 * Determines whether an element has a fully opaque background, whether solid color or an image
 * @param {Element} node
 * @return {Boolean} false if the background is transparent, true otherwise
 */
dom.isOpaque = function(node) {
	var bgColor = getBackgroundForSingleNode(node);
	if (bgColor === null || bgColor.alpha === 1) {
		return true;
	}
	return false;
};

/**
 * Returns the elements that are visually "above" this one in z-index order where
 * supported at the position given inside the top-left corner of the provided
 * rectangle. Where not supported (IE < 10), returns the DOM parents.
 * @param {Element} node
 * @return {Array} array of elements
 */
var getVisualParents = function(node) {
	var rect = node.getBoundingClientRect(),
	  visualParents,
		thisIndex,
		parents = [],
		fallbackToVisual = false,
		currentNode = node,
		nodeStyle = window.getComputedStyle(currentNode),
		posVal, topVal, bottomVal, leftVal, rightVal;

	while (currentNode !== null && (!dom.isOpaque(currentNode) || parseInt(nodeStyle.getPropertyValue('height'), 10) === 0)) {
		// If the element is positioned, we can't rely on DOM order to find visual parents
		posVal = nodeStyle.getPropertyValue('position');
		topVal = nodeStyle.getPropertyValue('top');
		bottomVal = nodeStyle.getPropertyValue('bottom');
		leftVal = nodeStyle.getPropertyValue('left');
		rightVal = nodeStyle.getPropertyValue('right');
		if ((posVal !== 'static' && posVal !== 'relative') ||
			(posVal === 'relative' &&
				(leftVal !== 'auto' ||
					rightVal !== 'auto' ||
					topVal !== 'auto' ||
					bottomVal !== 'auto'))) {
			fallbackToVisual = true;
		}
		currentNode = currentNode.parentElement;
		if (currentNode !== null) {
			nodeStyle = window.getComputedStyle(currentNode);
			if (parseInt(nodeStyle.getPropertyValue('height'), 10) !== 0) {
				parents.push(currentNode);
			}
		}
	}

	if (fallbackToVisual && dom.supportsElementsFromPoint(document)) {
		visualParents = dom.elementsFromPoint(document,
			Math.ceil(rect.left + 1),
			Math.ceil(rect.top + 1));
		thisIndex = visualParents.indexOf(node);

		// if the element is not present; then something is obscuring it thus making calculation impossible
		if (thisIndex === -1) {
			return null;
		}

		if (visualParents && (thisIndex < visualParents.length - 1)) {
			parents = visualParents.slice(thisIndex + 1);
		}
	}

	return parents;
};

var nullOrSomeOpacity = function(bgColor) {
	return (bgColor === null || bgColor.alpha !== 0);
};

var nullOrFullOpacity = function(bgColor) {
	return (bgColor === null || bgColor.alpha === 1);
};

var collectBackgroundColors = function(node, bgColor, parents, bgNodes, aggregate) {
	var parentNode;
	var parentColor;

	aggregate.push({
		color: bgColor,
		node: node,
	});

	parentNode = parents.shift();

	if (bgColor.alpha !== 1) {
		if (!parentNode) {
			if (node.tagName !== 'HTML') {
				return null;
			} else {
				//Assume white if top level is not specified
				parentColor = new color.Color(255, 255, 255, 1);
			}
		} else {
			if (!dom.visuallyContains(node, parentNode)) {
				return null;
			}

			parentColor = getBackgroundForSingleNode(parentNode);

			if (bgNodes && nullOrSomeOpacity(parentColor)) {
				bgNodes.push(parentNode);
			}

			if (parentColor === null) {
				return null;
			}
		}

		collectBackgroundColors(parentNode, parentColor, parents, bgNodes, aggregate);
	}

	return aggregate;
};

/**
 * Returns the flattened background color of an element, or null if it can't be determined because
 * there is no opaque ancestor element visually containing it, or because background images are used.
 * @param {Element} node
 * @param {Array} bgNodes array to which all encountered nodes should be appended
 * @param {Object} options
 * @return {Color}
 */
//TODO dsturley; why is this passing `bgNodes`?
color.getBackgroundColor = function(node, bgNodes, options) {
	var options = options || {};
	var bgColor = getBackgroundForSingleNode(node);
	var backgroundColors = [];
  var parents = [];

	if (bgNodes && nullOrSomeOpacity(bgColor)) {
		bgNodes.push(node);
	}

	if (nullOrFullOpacity(bgColor)) {
		return bgColor;
	}

	if(!options.noScroll) {
		node.scrollIntoView();
	}

  parents = getVisualParents(node);

	if (!parents) {
		return null;
	}

	backgroundColors = collectBackgroundColors(node, bgColor, parents, bgNodes, []);

	if (backgroundColors === null) {
		return null;
	}

	var currColorNode = backgroundColors.pop();
	var flattenedColor = currColorNode.color;

	while ((currColorNode = backgroundColors.pop()) !== undefined) {
		flattenedColor = color.flattenColors(currColorNode.color, flattenedColor);
	}

	return flattenedColor;
};
