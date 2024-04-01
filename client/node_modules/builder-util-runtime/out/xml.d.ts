export declare class XElement {
    readonly name: string;
    value: string;
    attributes: {
        [key: string]: string;
    } | null;
    isCData: boolean;
    elements: Array<XElement> | null;
    constructor(name: string);
    attribute(name: string): string;
    removeAttribute(name: string): void;
    element(name: string, ignoreCase?: boolean, errorIfMissed?: string | null): XElement;
    elementOrNull(name: string, ignoreCase?: boolean): XElement | null;
    getElements(name: string, ignoreCase?: boolean): XElement[];
    elementValueOrEmpty(name: string, ignoreCase?: boolean): string;
}
export declare function parseXml(data: string): XElement;
