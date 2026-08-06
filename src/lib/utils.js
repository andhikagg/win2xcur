/**
 * Premultiplies the alpha channel of a BGRA or RGBA pixel buffer.
 * @param {Buffer | Uint8Array} source 
 * @returns {Buffer}
 */
export function premultiplyAlpha(source) {
    const buffer = Buffer.from(source);
    for (let i = 0; i < buffer.length; i += 4) {
        const alpha = buffer[i + 3] / 255.0;
        buffer[i] = Math.round(buffer[i] * alpha);
        buffer[i + 1] = Math.round(buffer[i + 1] * alpha);
        buffer[i + 2] = Math.round(buffer[i + 2] * alpha);
    }
    return buffer;
}

/**
 * Undoes premultiplication of the alpha channel of a BGRA or RGBA pixel buffer.
 * Fully transparent pixels keep their color values untouched.
 * @param {Buffer | Uint8Array} source
 * @returns {Buffer}
 */
export function unpremultiplyAlpha(source) {
    const buffer = Buffer.from(source);
    for (let i = 0; i < buffer.length; i += 4) {
        const alpha = buffer[i + 3] / 255.0;
        if (alpha > 0) {
            buffer[i] = Math.min(255, Math.round(buffer[i] / alpha));
            buffer[i + 1] = Math.min(255, Math.round(buffer[i + 1] / alpha));
            buffer[i + 2] = Math.min(255, Math.round(buffer[i + 2] / alpha));
        }
    }
    return buffer;
}
