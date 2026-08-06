import { XCursorParser } from '../parser/xcursor.js';
import { premultiplyAlpha } from '../utils.js';

/**
 * Converts CursorFrames to X11 format buffer
 * @param {import('../cursor.js').CursorFrame[]} frames 
 * @returns {Promise<Buffer>}
 */
export async function toX11(frames) {
    const chunks = [];

    for (const frame of frames) {
        for (const cursor of frame.images) {
            const [hx, hy] = cursor.hotspot;
            
            // X11 wants BGRA. Sharp exports RGBA.
            // We must use resolveWithObject to get the true dimensions if the image was resized in the pipeline.
            const { data: rgbaRaw, info } = await cursor.image.raw().toBuffer({ resolveWithObject: true });
            const width = info.width;
            const height = info.height;

            const header = Buffer.alloc(36);
            header.writeUInt32LE(36, 0); // size
            header.writeUInt32LE(XCursorParser.CHUNK_IMAGE, 4); // actual_type
            header.writeUInt32LE(cursor.nominal, 8); // nominal_size
            header.writeUInt32LE(1, 12); // version
            header.writeUInt32LE(width, 16);
            header.writeUInt32LE(height, 20);
            header.writeUInt32LE(hx, 24);
            header.writeUInt32LE(hy, 28);
            header.writeUInt32LE(Math.round(frame.delay * 1000), 32);

            const bgraRaw = Buffer.alloc(rgbaRaw.length);
            for (let i = 0; i < rgbaRaw.length; i += 4) {
                bgraRaw[i] = rgbaRaw[i + 2];     // B
                bgraRaw[i + 1] = rgbaRaw[i + 1]; // G
                bgraRaw[i + 2] = rgbaRaw[i];     // R
                bgraRaw[i + 3] = rgbaRaw[i + 3]; // A
            }

            const premultiplied = premultiplyAlpha(bgraRaw);
            
            chunks.push({
                chunkType: XCursorParser.CHUNK_IMAGE,
                chunkSubtype: cursor.nominal,
                buffer: Buffer.concat([header, premultiplied])
            });
        }
    }

    const header = Buffer.alloc(16);
    XCursorParser.MAGIC.copy(header, 0);
    header.writeUInt32LE(16, 4); // header_size
    header.writeUInt32LE(XCursorParser.VERSION, 8);
    header.writeUInt32LE(chunks.length, 12);

    let offset = 16 + chunks.length * 12; // header size + TOC size
    const toc = [];

    for (const chunk of chunks) {
        const tocEntry = Buffer.alloc(12);
        tocEntry.writeUInt32LE(chunk.chunkType, 0);
        tocEntry.writeUInt32LE(chunk.chunkSubtype, 4);
        tocEntry.writeUInt32LE(offset, 8);
        toc.push(tocEntry);
        offset += chunk.buffer.length;
    }

    const buffers = [header, ...toc, ...chunks.map(c => c.buffer)];
    return Buffer.concat(buffers);
}
