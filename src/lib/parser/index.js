import { ANIParser } from './ani.js';
import { CURParser } from './cur.js';
import { XCursorParser } from './xcursor.js';

const PARSERS = [CURParser, ANIParser, XCursorParser];

/**
 * @param {Buffer} blob 
 * @returns {Promise<import('./base.js').BaseParser>}
 */
export async function openBlob(blob) {
    for (const parserClass of PARSERS) {
        if (parserClass.canParse(blob)) {
            const parser = new parserClass(blob);
            await parser.parse();
            return parser;
        }
    }
    throw new Error('Unsupported file format');
}
