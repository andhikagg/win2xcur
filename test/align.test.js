import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { openBlob } from '../src/lib/parser/index.js';
import { CursorFrame, CursorImage } from '../src/lib/cursor.js';
import { applyToFrames as applyAlign } from '../src/lib/align.js';
import { applyToFrames as applyScale } from '../src/lib/scale.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plana = path.join(__dirname, 'plana');

async function dims(image) {
    const { info } = await image.toBuffer({ resolveWithObject: true });
    return [info.width, info.height];
}

test('align extends images up to the nearest preferred size', async () => {
    const cursor = await openBlob(fs.readFileSync(path.join(plana, 'Person.cur')));
    assert.deepEqual(await dims(cursor.frames[0].images[0].image), [42, 42]);

    await applyAlign(cursor.frames, 'arrow');

    assert.deepEqual(await dims(cursor.frames[0].images[0].image), [48, 48]);
});

test('align keeps hotspot position', async () => {
    const cursor = await openBlob(fs.readFileSync(path.join(plana, 'Person.cur')));
    const image = cursor.frames[0].images[0];

    await applyAlign(cursor.frames, 'arrow');

    assert.deepEqual(image.hotspot, [10, 9]);
    assert.deepEqual(await dims(image.image), [48, 48]);
});

test('align is a no-op for images already at preferred sizes', async () => {
    const cursor = await openBlob(fs.readFileSync(path.join(plana, 'Person.cur')));
    await applyScale(cursor.frames, 32 / 42);

    assert.deepEqual(await dims(cursor.frames[0].images[0].image), [32, 32]);

    await applyAlign(cursor.frames, 'arrow');

    assert.deepEqual(await dims(cursor.frames[0].images[0].image), [32, 32]);
});

test('align crops content taller than the preferred size', async () => {
    const raw = Buffer.alloc(30 * 60 * 4); // 30x60, next preferred size is 32
    const image = sharp(raw, { raw: { width: 30, height: 60, channels: 4 } });
    const frames = [new CursorFrame([new CursorImage(image, [0, 0], 30)])];

    await applyAlign(frames, 'test');

    assert.deepEqual(await dims(frames[0].images[0].image), [32, 32]);
});