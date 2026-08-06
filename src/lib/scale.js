/**
 * Applies scaling to an array of CursorFrame instances.
 * @param {import('./cursor.js').CursorFrame[]} frames
 * @param {number} scale
 */
export async function applyToFrames(frames, scale) {
    for (const frame of frames) {
        for (const cursor of frame.images) {
            const metadata = await cursor.image.metadata();
            const newWidth = Math.round(metadata.width * scale);
            const newHeight = Math.round(metadata.height * scale);
            
            // sharp() instances are immutable for some operations, but resize returns a new instance
            // actually sharp operations are queued, but we might want to store the updated pipeline.
            // sharp clone and resize:
            cursor.image = cursor.image.resize(newWidth, newHeight, { kernel: 'lanczos3' });

            const [hx, hy] = cursor.hotspot;
            cursor.hotspot = [Math.round(hx * scale), Math.round(hy * scale)];
        }
    }
}

import { CursorImage } from './cursor.js';

/**
 * Generates multiple sizes for each frame to support dynamic scaling in DEs like XFCE.
 * @param {import('./cursor.js').CursorFrame[]} frames
 * @param {number[]} targetSizes
 */
export async function generateSizes(frames, targetSizes) {
    for (const frame of frames) {
        // Find the base image to scale from (the largest nominal size)
        let baseCursor = frame.images[0];
        let maxNominal = baseCursor.nominal;
        for (const img of frame.images) {
            if (img.nominal > maxNominal) {
                maxNominal = img.nominal;
                baseCursor = img;
            }
        }

        const newImages = [];
        const metadata = await baseCursor.image.metadata();
        const baseWidth = metadata.width;
        const baseHeight = metadata.height;
        
        for (const targetSize of targetSizes) {
            // Calculate scale ratio relative to the largest original nominal size
            const ratio = targetSize / maxNominal;
            const newWidth = Math.round(baseWidth * ratio);
            const newHeight = Math.round(baseHeight * ratio);

            const scaledSharp = baseCursor.image.clone().resize(newWidth, newHeight, { kernel: 'lanczos3' });
            const [hx, hy] = baseCursor.hotspot;
            const newHx = Math.round(hx * ratio);
            const newHy = Math.round(hy * ratio);

            newImages.push(new CursorImage(scaledSharp, [newHx, newHy], targetSize));
        }

        frame.images = newImages;
    }
}

