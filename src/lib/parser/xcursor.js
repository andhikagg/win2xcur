import { BaseParser } from './base.js';
import { CursorFrame, CursorImage } from '../cursor.js';
import { unpremultiplyAlpha } from '../utils.js';
import sharp from 'sharp';

export class XCursorParser extends BaseParser {
    static MAGIC = Buffer.from('Xcur');
    static VERSION = 0x10000;
    static CHUNK_IMAGE = 0xFFFD0002;

    /**
     * @param {Buffer} blob
     * @returns {boolean}
     */
    static canParse(blob) {
        return blob.length >= 4 && blob.subarray(0, 4).equals(this.MAGIC);
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
        if (!XCursorParser.canParse(this.blob)) {
            throw new Error('Not an Xcursor file');
        }

        const magic = this.blob.subarray(0, 4);
        const headerSize = this.blob.readUInt32LE(4);
        const version = this.blob.readUInt32LE(8);
        const tocSize = this.blob.readUInt32LE(12);

        if (version !== XCursorParser.VERSION) {
            throw new Error(`Unsupported Xcursor version 0x${version.toString(16)}`);
        }

        let offset = 16;
        const chunks = [];
        for (let i = 0; i < tocSize; i++) {
            const chunkType = this.blob.readUInt32LE(offset);
            const chunkSubtype = this.blob.readUInt32LE(offset + 4);
            const position = this.blob.readUInt32LE(offset + 8);
            chunks.push({ chunkType, chunkSubtype, position });
            offset += 12;
        }

        const imagesBySize = new Map();

        for (const { chunkType, chunkSubtype, position } of chunks) {
            if (chunkType !== XCursorParser.CHUNK_IMAGE) continue;

            const size = this.blob.readUInt32LE(position);
            const actualType = this.blob.readUInt32LE(position + 4);
            const nominalSize = this.blob.readUInt32LE(position + 8);
            const imgVersion = this.blob.readUInt32LE(position + 12);
            const width = this.blob.readUInt32LE(position + 16);
            const height = this.blob.readUInt32LE(position + 20);
            const xOffset = this.blob.readUInt32LE(position + 24);
            const yOffset = this.blob.readUInt32LE(position + 28);
            const delay = this.blob.readUInt32LE(position + 32) / 1000.0;

            if (size !== 36) {
                throw new Error(`Unexpected size: ${size}, expected 36`);
            }
            if (actualType !== chunkType) {
                throw new Error(`Unexpected chunk type: ${actualType}, expected ${chunkType}`);
            }
            if (nominalSize !== chunkSubtype) {
                throw new Error(`Unexpected nominal size: ${nominalSize}, expected ${chunkSubtype}`);
            }
            if (width > 0x7FFF) throw new Error(`Image width too large: ${width}`);
            if (height > 0x7FFF) throw new Error(`Image height too large: ${height}`);
            if (xOffset > width) throw new Error(`Hotspot x-coordinate too large: ${xOffset}`);
            if (yOffset > height) throw new Error(`Hotspot y-coordinate too large: ${yOffset}`);

            const imageStart = position + 36;
            const imageSize = width * height * 4;
            const blob = this.blob.subarray(imageStart, imageStart + imageSize);

            if (blob.length !== imageSize) {
                throw new Error(`Invalid image at ${imageStart}: expected ${imageSize} bytes, got ${blob.length} bytes`);
            }

            // Xcursor stores BGRA. Sharp expects RGBA for raw pixels or we can just swap channels.
            const rgbaBlob = Buffer.alloc(imageSize);
            for (let i = 0; i < imageSize; i += 4) {
                rgbaBlob[i] = blob[i + 2];     // R
                rgbaBlob[i + 1] = blob[i + 1]; // G
                rgbaBlob[i + 2] = blob[i];     // B
                rgbaBlob[i + 3] = blob[i + 3]; // A
            }

            const image = sharp(unpremultiplyAlpha(rgbaBlob), {
                raw: {
                    width,
                    height,
                    channels: 4
                }
            });

            if (!imagesBySize.has(nominalSize)) {
                imagesBySize.set(nominalSize, []);
            }
            imagesBySize.get(nominalSize).push({ image: new CursorImage(image, [xOffset, yOffset], nominalSize), delay });
        }

        const sizeCounts = new Set([...imagesBySize.values()].map(arr => arr.length));
        if (sizeCounts.size !== 1) {
            throw new Error('win2xcur does not support animations where each size has different number of frames');
        }

        const result = [];
        const arrays = [...imagesBySize.values()];
        const numFrames = arrays[0].length;

        for (let i = 0; i < numFrames; i++) {
            const frameImages = [];
            const frameDelays = new Set();
            for (const arr of arrays) {
                frameImages.push(arr[i].image);
                frameDelays.add(arr[i].delay);
            }

            if (frameDelays.size !== 1) {
                throw new Error('win2xcur does not support animations where each size has a different frame delay');
            }

            result.push(new CursorFrame(frameImages, [...frameDelays][0]));
        }

        this.frames = result;
    }
}
