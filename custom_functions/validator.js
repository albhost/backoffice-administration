'use strict'

/**
 * Checks whether the provided string is an integer.
 * @param {String} str String input.
 * @param {Object} [options] Options.
 * @param {Number} [options.min] Min limit inclusive.
 * @param {Number} [options.max] Max limit inclusive.
 * @returns {Boolean} true or false
 */
function isInt(str, options) {
    if (isNaN(str)) {
        return false;
    }

    if (!options) {
        return true;
    }

    const val = parseInt(str);
    
    if (options.min != undefined && val < options.min) {
        return false;
    }

    if (options.max != undefined && val > options.max) {
        return false;
    }

    return true;
}

module.exports = {
    isInt
}