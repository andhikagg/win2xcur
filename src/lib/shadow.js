import sharp from 'sharp';

/**
 * 
 * @param {sharp.Sharp} image 
 * @param {object} options 
 * @returns {Promise<sharp.Sharp>}
 */
export async function applyToImage(image, { color, radius, sigma, xoffset, yoffset, opacity = 50 }) {
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    const xOff = Math.round(xoffset * width);
    const yOff = Math.round(yoffset * height);
    const newWidth = width + 3 * xOff;
    const newHeight = height + 3 * yOff;

    // Create a larger canvas with transparent background
    const canvas = sharp({
        create: {
            width: newWidth,
            height: newHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    });

    // We need to create a shadow:
    // 1. Extract the alpha channel of the original image (width*height bytes)
    const alphaRaw = await image.clone().extractChannel('alpha').raw().toBuffer();

    // 2. Place the alpha onto a larger buffer offset by (xOff, yOff), then blur it
    const shadowAlpha = Buffer.alloc(newWidth * newHeight); // all zeros
    for (let y = 0; y < height; y++) {
        alphaRaw.copy(shadowAlpha, (y + yOff) * newWidth + xOff, y * width, (y + 1) * width);
    }

    // Blur the offset alpha channel and reduce its opacity
    // Sharp's blur takes sigma.
    const opacityFactor = Math.min(1, Math.max(0, opacity / 100));
    const blurredAlpha = await sharp(shadowAlpha, {
        raw: { width: newWidth, height: newHeight, channels: 1 }
    })
    .blur(sigma * width)
    .linear(opacityFactor, 0) // modulate to opacity% (multiplier opacity/100)
    .raw()
    .toBuffer();

    // 3. Create a colored shadow image using the blurred alpha
    const [r, g, b] = hexToRgb(color);
    const shadowRgba = Buffer.alloc(newWidth * newHeight * 4);
    for (let i = 0; i < newWidth * newHeight; i++) {
        shadowRgba[i * 4] = r;
        shadowRgba[i * 4 + 1] = g;
        shadowRgba[i * 4 + 2] = b;
        shadowRgba[i * 4 + 3] = blurredAlpha[i];
    }
    const coloredShadow = await sharp(shadowRgba, {
        raw: { width: newWidth, height: newHeight, channels: 4 }
    })
    .png()
    .toBuffer();

    // 4. Composite the original image over the shadow
    const finalImageBuffer = await canvas
        .composite([
            { input: coloredShadow, top: 0, left: 0 },
            { input: await image.png().toBuffer(), top: 0, left: 0 }
        ])
        .png()
        .toBuffer();

    // Trim the image (similar to wand's trim)
    // Sharp's trim automatically removes border pixels of the same color as the top-left pixel (or transparent)
    const trimmed = sharp(finalImageBuffer).trim();
    const trimmedMetadata = await trimmed.metadata();

    // Ensure we don't shrink below original size
    const finalWidth = Math.max(width, trimmedMetadata.width || 0);
    const finalHeight = Math.max(height, trimmedMetadata.height || 0);

    // If we need to expand it back, we can just extract from the un-trimmed if it was smaller, but trim already gives us the bounding box.
    // Actually, python says: result.crop(width=max(image.width, trimmed.width), height=max(image.height, trimmed.height))
    // Sharp trim removes the transparent padding. If the resulting size is smaller than original, it pads.
    // For simplicity, let's just return the trimmed image padded to max(original, trimmed).
    
    return trimmed.resize({
        width: finalWidth,
        height: finalHeight,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        position: 'northwest'
    });
}

/**
 * 
 * @param {import('./cursor.js').CursorFrame[]} frames 
 * @param {object} options 
 */
export async function applyToFrames(frames, { color, radius, sigma, xoffset, yoffset, opacity = 50 }) {
    for (const frame of frames) {
        for (const cursor of frame.images) {
            cursor.image = await applyToImage(cursor.image, { color, radius, sigma, xoffset, yoffset, opacity });
        }
    }
}

function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return [num >> 16, (num >> 8) & 255, num & 255];
}
