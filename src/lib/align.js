import { logger } from './logger.js';

const PREFERRED_SIZES = [32, 48, 64, 96, 128, 256];

/**
 * Aligns cursor image dimensions to the nearest Windows preferred size
 * by extending (not scaling) the canvas with a transparent background.
 *
 * @param {import('./cursor.js').CursorFrame[]} frames
 * @param {string} name - Name used in the crop warning message.
 * @returns {Promise<void>}
 */
export async function applyToFrames(frames, name) {
    for (const frame of frames) {
        for (const cursor of frame.images) {
            // metadata() reflects the input dimensions, not the pipeline output,
            // so render to learn the true current size.
            const { info } = await cursor.image.toBuffer({ resolveWithObject: true });
            const { width, height } = info;

            const nextSize = PREFERRED_SIZES.find(size => size >= width);
            if (nextSize === undefined) continue;

            if (nextSize === width && nextSize === height) continue;

            if (nextSize < height) {
                logger.warn(`Warning: aligning ${width}x${height} cursor would crop content: ${name}`);
            }

            const cropWidth = Math.min(width, nextSize);
            const cropHeight = Math.min(height, nextSize);

            let image = cursor.image;
            if (cropWidth !== width || cropHeight !== height) {
                image = image.extract({ left: 0, top: 0, width: cropWidth, height: cropHeight });
            }

            cursor.image = image.extend({
                top: 0,
                left: 0,
                bottom: nextSize - cropHeight,
                right: nextSize - cropWidth,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            });
        }
    }
}
