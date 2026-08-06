import { BaseParser } from './base.js';
import { CursorFrame, CursorImage } from '../cursor.js';
import sharp from 'sharp';

export class CURParser extends BaseParser {
    static MAGIC = Buffer.from([0, 0, 2, 0]);
    static ICO_TYPE_CUR = 2;

    /**
     * @param {Buffer} blob
     * @returns {boolean}
     */
    static canParse(blob) {
        return blob.subarray(0, this.MAGIC.length).equals(this.MAGIC);
    }

    /**
     * @param {Buffer} blob
     */
    constructor(blob) {
        super(blob);
    }

    /**
     * Parse the buffer into CursorFrames.
     * Needs to be async because sharp uses promises.
     * @returns {Promise<void>}
     */
    async parse() {
        if (!CURParser.canParse(this.blob)) {
            throw new Error('Not a .cur file');
        }

        const hotspots = this._parseHeader();
        
        // The original python code read `self._image.sequence` from Wand.
        // We will manually extract the image buffers from the .cur file,
        // convert DIB to raw pixels (if necessary), and create sharp instances.
        const images = [];

        const imageCount = hotspots.length;
        let offset = 6; // ICON_DIR size

        for (let i = 0; i < imageCount; i++) {
            const width = this.blob.readUInt8(offset) || 256;
            const height = this.blob.readUInt8(offset + 1) || 256;
            const hx = this.blob.readUInt16LE(offset + 4);
            const hy = this.blob.readUInt16LE(offset + 6);
            const size = this.blob.readUInt32LE(offset + 8);
            const fileOffset = this.blob.readUInt32LE(offset + 12);
            offset += 16;

            const imageBlob = this.blob.subarray(fileOffset, fileOffset + size);

            // Check if PNG magic
            const isPng = imageBlob.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
            
            let sharpImg;
            if (isPng) {
                sharpImg = sharp(imageBlob);
            } else {
                sharpImg = this._parseDIB(imageBlob);
            }
            
            // sharp can figure out width/height from PNG. For DIB, we pass raw data.
            const meta = await sharpImg.metadata();
            images.push(new CursorImage(sharpImg, [hx, hy], meta.width));
        }

        this.frames = [new CursorFrame(images, 0)];
    }

    _parseHeader() {
        const reserved = this.blob.readUInt16LE(0);
        const icoType = this.blob.readUInt16LE(2);
        const imageCount = this.blob.readUInt16LE(4);

        if (reserved !== 0) throw new Error("Invalid reserved bytes");
        if (icoType !== CURParser.ICO_TYPE_CUR) throw new Error("Not a CUR format");

        let offset = 6;
        const hotspots = [];
        for (let i = 0; i < imageCount; i++) {
            const hx = this.blob.readUInt16LE(offset + 4);
            const hy = this.blob.readUInt16LE(offset + 6);
            hotspots.push([hx, hy]);
            offset += 16;
        }

        return hotspots;
    }

    /**
     * Converts a Windows DIB buffer into a Sharp instance.
     * @param {Buffer} dib 
     * @returns {import('sharp').Sharp}
     */
    _parseDIB(dib) {
        // Parse BITMAPINFOHEADER
        const biSize = dib.readUInt32LE(0);
        const biWidth = dib.readInt32LE(4);
        const biHeight = dib.readInt32LE(8) / 2; // Icon DIB heights are doubled (image + mask)
        const biPlanes = dib.readUInt16LE(12);
        const biBitCount = dib.readUInt16LE(14);
        const biCompression = dib.readUInt32LE(16);
        const biSizeImage = dib.readUInt32LE(20);
        const biClrUsed = dib.readUInt32LE(32);

        if (biCompression !== 0) { // BI_RGB
            throw new Error(`Unsupported DIB compression: ${biCompression}`);
        }

        let colorTableSize = 0;
        if (biBitCount <= 8) {
            colorTableSize = (biClrUsed || (1 << biBitCount)) * 4;
        }

        const pixelsOffset = biSize + colorTableSize;
        const maskOffset = pixelsOffset + (Math.floor((biWidth * biBitCount + 31) / 32) * 4) * biHeight;
        
        const rawPixels = Buffer.alloc(biWidth * biHeight * 4); // RGBA

        // Windows DIBs are stored bottom-up, so we write to our buffer from the end
        if (biBitCount === 32) {
            let srcOffset = pixelsOffset;
            for (let y = biHeight - 1; y >= 0; y--) {
                const dstRowStart = y * biWidth * 4;
                for (let x = 0; x < biWidth; x++) {
                    const b = dib[srcOffset++];
                    const g = dib[srcOffset++];
                    const r = dib[srcOffset++];
                    const a = dib[srcOffset++];
                    
                    const dstOffset = dstRowStart + x * 4;
                    rawPixels[dstOffset] = r;
                    rawPixels[dstOffset + 1] = g;
                    rawPixels[dstOffset + 2] = b;
                    rawPixels[dstOffset + 3] = a;
                }
            }
        } else if (biBitCount === 1 || biBitCount === 8) {
            // Read palette
            const palette = [];
            for (let i = 0; i < colorTableSize; i += 4) {
                palette.push({
                    b: dib[biSize + i],
                    g: dib[biSize + i + 1],
                    r: dib[biSize + i + 2],
                    a: 255 // DIB palette doesn't use alpha byte (usually reserved)
                });
            }

            const rowBytes = Math.floor((biWidth * biBitCount + 31) / 32) * 4;
            const maskRowBytes = Math.floor((biWidth + 31) / 32) * 4;

            for (let y = 0; y < biHeight; y++) {
                // DIBs are bottom-up
                const srcY = biHeight - 1 - y;
                
                const xorRowStart = pixelsOffset + srcY * rowBytes;
                const andRowStart = maskOffset + srcY * maskRowBytes;
                const dstRowStart = y * biWidth * 4;

                for (let x = 0; x < biWidth; x++) {
                    let colorIndex = 0;
                    if (biBitCount === 1) {
                        const xorByte = dib[xorRowStart + Math.floor(x / 8)];
                        colorIndex = (xorByte >> (7 - (x % 8))) & 1;
                    } else if (biBitCount === 8) {
                        colorIndex = dib[xorRowStart + x];
                    }

                    const andByte = dib[andRowStart + Math.floor(x / 8)];
                    const andBit = (andByte >> (7 - (x % 8))) & 1;

                    const dstOffset = dstRowStart + x * 4;

                    const color = palette[colorIndex] || {r: 0, g: 0, b: 0, a: 255};
                    
                    rawPixels[dstOffset] = color.r;
                    rawPixels[dstOffset + 1] = color.g;
                    rawPixels[dstOffset + 2] = color.b;
                    
                    // AND mask determines transparency
                    rawPixels[dstOffset + 3] = andBit === 0 ? 255 : 0;
                }
            }
        } else {
            throw new Error(`Unsupported bit depth: ${biBitCount}`);
        }

        return sharp(rawPixels, {
            raw: {
                width: biWidth,
                height: biHeight,
                channels: 4
            }
        });
    }
}
