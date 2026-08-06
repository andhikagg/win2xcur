export class BaseParser {
    /**
     * @param {Buffer} blob
     */
    constructor(blob) {
        this.blob = blob;
        /** @type {import('../cursor.js').CursorFrame[]} */
        this.frames = [];
    }

    /**
     * @param {Buffer} blob
     * @returns {boolean}
     */
    static canParse(blob) {
        throw new Error("Not implemented");
    }
}
