import { BaseParser } from './base.js';
import { CURParser } from './cur.js';

export class ANIParser extends BaseParser {
    static SIGNATURE = Buffer.from('RIFF');
    static ANI_TYPE = Buffer.from('ACON');
    static HEADER_CHUNK = Buffer.from('anih');
    static LIST_CHUNK = Buffer.from('LIST');
    static SEQ_CHUNK = Buffer.from('seq ');
    static RATE_CHUNK = Buffer.from('rate');
    static FRAME_TYPE = Buffer.from('fram');
    static ICON_CHUNK = Buffer.from('icon');
    static SEQUENCE_FLAG = 0x2;
    static ICON_FLAG = 0x1;

    /**
     * @param {Buffer} blob
     * @returns {boolean}
     */
    static canParse(blob) {
        if (blob.length < 12) return false;
        const signature = blob.subarray(0, 4);
        const subtype = blob.subarray(8, 12);
        return signature.equals(this.SIGNATURE) && subtype.equals(this.ANI_TYPE);
    }

    /**
     * @param {Buffer} blob
     */
    constructor(blob) {
        super(blob);
    }

    /**
     * @returns {Promise<void>}
     */
    async parse() {
        if (!ANIParser.canParse(this.blob)) {
            throw new Error('Not a .ani file');
        }
        
        await this._parseRIFF(12);
    }

    /**
     * @param {number} offset 
     * @param {Buffer[]} expected 
     * @returns {{name: Buffer, size: number, nextOffset: number}}
     */
    _readChunk(offset, expected) {
        const found = [];
        while (offset < this.blob.length) {
            const name = this.blob.subarray(offset, offset + 4);
            const size = this.blob.readUInt32LE(offset + 4);
            offset += 8;

            let isExpected = false;
            for (const exp of expected) {
                if (name.equals(exp)) {
                    isExpected = true;
                    break;
                }
            }

            if (isExpected) {
                return { name, size, nextOffset: offset };
            }

            found.push(name.toString('utf8'));
            offset += size;
            if (offset % 2 !== 0) {
                offset++;
            }
        }
        throw new Error(`Expected chunk ${expected.map(e=>e.toString()).join(',')}, found ${found.join(',')}`);
    }

    /**
     * @param {number} offset 
     */
    async _parseRIFF(offset) {
        let chunk = this._readChunk(offset, [ANIParser.HEADER_CHUNK]);
        let size = chunk.size;
        offset = chunk.nextOffset;

        if (size !== 36) {
            throw new Error(`Unexpected anih header size ${size}, expected 36`);
        }

        const cbSize = this.blob.readUInt32LE(offset);
        const frameCount = this.blob.readUInt32LE(offset + 4);
        const stepCount = this.blob.readUInt32LE(offset + 8);
        const width = this.blob.readUInt32LE(offset + 12);
        const height = this.blob.readUInt32LE(offset + 16);
        const bitCount = this.blob.readUInt32LE(offset + 20);
        const planes = this.blob.readUInt32LE(offset + 24);
        const displayRate = this.blob.readUInt32LE(offset + 28); // Jiffies (1/60th of a second)
        const flags = this.blob.readUInt32LE(offset + 32);

        if (cbSize !== 36) {
            throw new Error(`Unexpected size in anih header ${cbSize}, expected 36`);
        }

        if (!(flags & ANIParser.ICON_FLAG)) {
            throw new Error('Raw BMP images not supported.');
        }

        offset += 36;
        if (offset % 2 !== 0) offset++;

        const frames = [];
        let order = Array.from({ length: frameCount }, (_, i) => i);
        let delays = Array.from({ length: stepCount }, () => displayRate / 60.0);

        while (offset < this.blob.length) {
            try {
                chunk = this._readChunk(offset, [ANIParser.LIST_CHUNK, ANIParser.SEQ_CHUNK, ANIParser.RATE_CHUNK]);
            } catch (e) {
                // No more of these chunks, stop parsing RIFF
                break;
            }
            
            const name = chunk.name;
            size = chunk.size;
            offset = chunk.nextOffset;

            if (name.equals(ANIParser.LIST_CHUNK)) {
                const listEnd = offset + size;
                const listType = this.blob.subarray(offset, offset + 4);
                if (!listType.equals(ANIParser.FRAME_TYPE)) {
                    throw new Error(`Unexpected RIFF list type: ${listType.toString('utf8')}, expected fram`);
                }
                offset += 4;

                for (let i = 0; i < frameCount; i++) {
                    chunk = this._readChunk(offset, [ANIParser.ICON_CHUNK]);
                    const iconSize = chunk.size;
                    offset = chunk.nextOffset;

                    const curBlob = this.blob.subarray(offset, offset + iconSize);
                    const curParser = new CURParser(curBlob);
                    await curParser.parse();
                    frames.push(curParser.frames[0]); // cur format only has 1 frame (but multiple sizes as images)

                    offset += iconSize;
                    if (offset % 2 !== 0) {
                        offset += 1;
                    }
                }

                if (offset !== listEnd && listEnd < this.blob.length) {
                    // Sometimes padding or slight mismatch occurs. Just set offset to listEnd to be safe
                    offset = listEnd;
                }
            } else if (name.equals(ANIParser.SEQ_CHUNK)) {
                order = [];
                for (let i = 0; i < size; i += 4) {
                    order.push(this.blob.readUInt32LE(offset + i));
                }
                offset += size;
                if (offset % 2 !== 0) offset++;
            } else if (name.equals(ANIParser.RATE_CHUNK)) {
                delays = [];
                for (let i = 0; i < size; i += 4) {
                    delays.push(this.blob.readUInt32LE(offset + i) / 60.0);
                }
                offset += size;
                if (offset % 2 !== 0) offset++;
            }
        }

        // Reconstruct animation sequence using order and delays
        this.frames = [];
        for (let i = 0; i < stepCount; i++) {
            const frameIndex = order[i];
            const frame = frames[frameIndex].clone();
            frame.delay = delays[i];
            this.frames.push(frame);
        }
    }
}
