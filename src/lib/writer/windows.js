import { CURParser } from '../parser/cur.js';
import { ANIParser } from '../parser/ani.js';

/**
 * @param {import('../cursor.js').CursorFrame} frame 
 * @returns {Promise<Buffer>}
 */
export async function toCur(frame) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(CURParser.ICO_TYPE_CUR, 2);
    header.writeUInt16LE(frame.images.length, 4);

    const directory = [];
    const imageData = [];
    let offset = 6 + frame.images.length * 16;

    for (const cursor of frame.images) {
        const { data: pngBlob, info } = await cursor.image.png().toBuffer({ resolveWithObject: true });
        
        if (info.width > 256 || info.height > 256) {
            throw new Error(`Image too big for CUR format: ${info.width}x${info.height}`);
        }

        imageData.push(pngBlob);

        const [xOffset, yOffset] = cursor.hotspot;
        const entry = Buffer.alloc(16);
        entry.writeUInt8(info.width === 256 ? 0 : info.width, 0);
        entry.writeUInt8(info.height === 256 ? 0 : info.height, 1);
        entry.writeUInt8(0, 2); // color count
        entry.writeUInt8(0, 3); // reserved
        entry.writeUInt16LE(xOffset, 4);
        entry.writeUInt16LE(yOffset, 6);
        entry.writeUInt32LE(pngBlob.length, 8);
        entry.writeUInt32LE(offset, 12);
        
        directory.push(entry);
        offset += pngBlob.length;
    }

    return Buffer.concat([header, ...directory, ...imageData]);
}

/**
 * @param {import('../cursor.js').CursorFrame[]} frames 
 * @returns {Promise<Buffer>}
 */
async function getAniCurList(frames) {
    const chunks = [];
    for (const frame of frames) {
        const curFile = await toCur(frame);
        const header = Buffer.alloc(8);
        ANIParser.ICON_CHUNK.copy(header, 0);
        header.writeUInt32LE(curFile.length, 4);
        
        chunks.push(header);
        chunks.push(curFile);
        if (curFile.length % 2 !== 0) {
            chunks.push(Buffer.from([0]));
        }
    }
    return Buffer.concat(chunks);
}

/**
 * @param {import('../cursor.js').CursorFrame[]} frames 
 * @returns {Buffer}
 */
function getAniRateChunk(frames) {
    const size = frames.length * 4;
    const header = Buffer.alloc(8);
    ANIParser.RATE_CHUNK.copy(header, 0);
    header.writeUInt32LE(size, 4);

    const rates = Buffer.alloc(size);
    for (let i = 0; i < frames.length; i++) {
        rates.writeUInt32LE(Math.round(frames[i].delay * 60), i * 4);
    }
    return Buffer.concat([header, rates]);
}

/**
 * @param {import('../cursor.js').CursorFrame[]} frames 
 * @returns {Promise<Buffer>}
 */
export async function toAni(frames) {
    const aniHeader = Buffer.alloc(36);
    aniHeader.writeUInt32LE(36, 0); // size
    aniHeader.writeUInt32LE(frames.length, 4); // frame_count
    aniHeader.writeUInt32LE(frames.length, 8); // step_count
    aniHeader.writeUInt32LE(0, 12); // width
    aniHeader.writeUInt32LE(0, 16); // height
    aniHeader.writeUInt32LE(32, 20); // bit_count
    aniHeader.writeUInt32LE(1, 24); // planes
    aniHeader.writeUInt32LE(1, 28); // display_rate
    aniHeader.writeUInt32LE(ANIParser.ICON_FLAG, 32); // flags

    const curList = await getAniCurList(frames);

    const chunkHeader1 = Buffer.alloc(8);
    ANIParser.HEADER_CHUNK.copy(chunkHeader1, 0);
    chunkHeader1.writeUInt32LE(36, 4);

    const riffListHeader = Buffer.alloc(12);
    ANIParser.LIST_CHUNK.copy(riffListHeader, 0);
    riffListHeader.writeUInt32LE(curList.length + 4, 4);
    ANIParser.FRAME_TYPE.copy(riffListHeader, 8);

    const rateChunk = getAniRateChunk(frames);

    const body = Buffer.concat([
        chunkHeader1,
        aniHeader,
        riffListHeader,
        curList,
        rateChunk
    ]);

    const riffHeader = Buffer.alloc(12);
    ANIParser.SIGNATURE.copy(riffHeader, 0);
    riffHeader.writeUInt32LE(body.length + 4, 4);
    ANIParser.ANI_TYPE.copy(riffHeader, 8);

    return Buffer.concat([riffHeader, body]);
}

/**
 * @param {import('../cursor.js').CursorFrame[]} frames 
 * @returns {Promise<[string, Buffer]>}
 */
export async function toSmart(frames) {
    if (frames.length === 1) {
        return ['.cur', await toCur(frames[0])];
    } else {
        return ['.ani', await toAni(frames)];
    }
}
