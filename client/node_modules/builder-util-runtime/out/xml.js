"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseXml = exports.XElement = void 0;
const sax = require("sax");
const index_1 = require("./index");
class XElement {
    constructor(name) {
        this.name = name;
        this.value = "";
        this.attributes = null;
        this.isCData = false;
        this.elements = null;
        if (!name) {
            throw index_1.newError("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
        }
        if (!isValidName(name)) {
            throw index_1.newError(`Invalid element name: ${name}`, "ERR_XML_ELEMENT_INVALID_NAME");
        }
    }
    attribute(name) {
        const result = this.attributes === null ? null : this.attributes[name];
        if (result == null) {
            throw index_1.newError(`No attribute "${name}"`, "ERR_XML_MISSED_ATTRIBUTE");
        }
        return result;
    }
    removeAttribute(name) {
        if (this.attributes !== null) {
            delete this.attributes[name];
        }
    }
    element(name, ignoreCase = false, errorIfMissed = null) {
        const result = this.elementOrNull(name, ignoreCase);
        if (result === null) {
            throw index_1.newError(errorIfMissed || `No element "${name}"`, "ERR_XML_MISSED_ELEMENT");
        }
        return result;
    }
    elementOrNull(name, ignoreCase = false) {
        if (this.elements === null) {
            return null;
        }
        for (const element of this.elements) {
            if (isNameEquals(element, name, ignoreCase)) {
                return element;
            }
        }
        return null;
    }
    getElements(name, ignoreCase = false) {
        if (this.elements === null) {
            return [];
        }
        return this.elements.filter(it => isNameEquals(it, name, ignoreCase));
    }
    elementValueOrEmpty(name, ignoreCase = false) {
        const element = this.elementOrNull(name, ignoreCase);
        return element === null ? "" : element.value;
    }
}
exports.XElement = XElement;
const NAME_REG_EXP = new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
function isValidName(name) {
    return NAME_REG_EXP.test(name);
}
function isNameEquals(element, name, ignoreCase) {
    const elementName = element.name;
    return elementName === name || (ignoreCase === true && elementName.length === name.length && elementName.toLowerCase() === name.toLowerCase());
}
function parseXml(data) {
    let rootElement = null;
    const parser = sax.parser(true, {});
    const elements = [];
    parser.onopentag = saxElement => {
        const element = new XElement(saxElement.name);
        element.attributes = saxElement.attributes;
        if (rootElement === null) {
            rootElement = element;
        }
        else {
            const parent = elements[elements.length - 1];
            if (parent.elements == null) {
                parent.elements = [];
            }
            parent.elements.push(element);
        }
        elements.push(element);
    };
    parser.onclosetag = () => {
        elements.pop();
    };
    parser.ontext = text => {
        if (elements.length > 0) {
            elements[elements.length - 1].value = text;
        }
    };
    parser.oncdata = cdata => {
        const element = elements[elements.length - 1];
        element.value = cdata;
        element.isCData = true;
    };
    parser.onerror = err => {
        throw err;
    };
    parser.write(data);
    return rootElement;
}
exports.parseXml = parseXml;
//# sourceMappingURL=xml.js.map