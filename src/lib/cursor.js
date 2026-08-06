export class CursorImage {
    /**
     * @param {import('sharp').Sharp} image - The sharp image instance
     * @param {[number, number]} hotspot - [x, y] coordinates of the hotspot
     * @param {number} nominal - Nominal size of the cursor image
     */
    constructor(image, hotspot, nominal) {
        this.image = image;
        this.hotspot = hotspot;
        this.nominal = nominal;
    }

    clone() {
        return new CursorImage(this.image.clone(), [...this.hotspot], this.nominal);
    }
}

export class CursorFrame {
    /**
     * @param {CursorImage[]} images - Array of CursorImage instances
     * @param {number} delay - Delay in seconds
     */
    constructor(images, delay = 0) {
        this.images = images;
        this.delay = delay;
    }

    clone() {
        return new CursorFrame(this.images.map(image => image.clone()), this.delay);
    }
}
