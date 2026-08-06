import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openBlob } from '../src/lib/parser/index.js';
import { toX11 } from '../src/lib/writer/x11.js';
import { toCur, toAni, toSmart } from '../src/lib/writer/windows.js';
import { premultiplyAlpha, unpremultiplyAlpha } from '../src/lib/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plana = path.join(__dirname, 'plana');

function readPlana(file) {
    return fs.readFileSync(path.join(plana, file));
}

test('toSmart picks .cur for single-frame cursors', async () => {
    const cursor = await openBlob(readPlana('Person.cur'));
    const [ext, result] = await toSmart(cursor.frames);
    assert.equal(ext, '.cur');
    assert.ok(Buffer.isBuffer(result));
});

test('toSmart picks .ani for multi-frame cursors', async () => {
    const cursor = await openBlob(readPlana('Normal.ani'));
    const [ext, result] = await toSmart(cursor.frames);
    assert.equal(ext, '.ani');
    assert.ok(result.subarray(0, 4).equals(Buffer.from('RIFF')));
    assert.ok(result.subarray(8, 12).equals(Buffer.from('ACON')));
});

test('toCur preserves hotspot and dimensions', async () => {
    const cursor = await openBlob(readPlana('Person.cur'));
    const cur = await toCur(cursor.frames[0]);

    const reparsed = await openBlob(cur);
    const image = reparsed.frames[0].images[0];
    const metadata = await image.image.metadata();
    assert.equal(metadata.width, 42);
    assert.equal(metadata.height, 42);
    assert.deepEqual(image.hotspot, [10, 9]);
});

test('toAni preserves frame count and delays', async () => {
    const cursor = await openBlob(readPlana('Normal.ani'));
    const ani = await toAni(cursor.frames);

    const reparsed = await openBlob(ani);
    assert.equal(reparsed.frames.length, 16);
    for (const frame of reparsed.frames) {
        assert.ok(Math.abs(frame.delay - 0.1) < 1e-9);
    }
});

test('toX11 produces a valid Xcursor file', async () => {
    const cursor = await openBlob(readPlana('Person.cur'));
    const x11 = await toX11(cursor.frames);
    assert.ok(x11.subarray(0, 4).equals(Buffer.from('Xcur')));

    const reparsed = await openBlob(x11);
    const image = reparsed.frames[0].images[0];
    const metadata = await image.image.metadata();
    assert.equal(metadata.width, 42);
    assert.equal(metadata.height, 42);
    assert.deepEqual(image.hotspot, [10, 9]);
    assert.equal(image.nominal, 42);
});

test('premultiplyAlpha multiplies color channels by alpha', () => {
    // RGBA pixel with alpha 0x80 (128): colors halve.
    const input = Buffer.from([100, 150, 200, 128]);
    const output = premultiplyAlpha(input);
    assert.equal(output[0], Math.round(100 * (128 / 255)));
    assert.equal(output[1], Math.round(150 * (128 / 255)));
    assert.equal(output[2], Math.round(200 * (128 / 255)));
    assert.equal(output[3], 128);

    // Fully transparent pixels become black.
    const transparent = Buffer.from([255, 255, 255, 0]);
    const out = premultiplyAlpha(transparent);
    assert.deepEqual([...out.subarray(0, 3)], [0, 0, 0]);
});

test('unpremultiplyAlpha recovers color channels', () => {
    // Alpha 204/255: colors must be divided back up.
    const input = Buffer.from([51, 102, 153, 204]);
    const output = unpremultiplyAlpha(input);
    const factor = 204 / 255;
    assert.equal(output[0], Math.min(255, Math.round(51 / factor)));
    assert.equal(output[1], Math.min(255, Math.round(102 / factor)));
    assert.equal(output[2], Math.min(255, Math.round(153 / factor)));
    assert.equal(output[3], 204);

    // Opaque and fully transparent pixels stay untouched.
    const opaque = Buffer.from([200, 100, 50, 255, 0, 0, 0, 255]);
    assert.deepEqual([...unpremultiplyAlpha(opaque)], [...opaque]);
    const clear = Buffer.from([0, 0, 0, 0]);
    assert.deepEqual([...unpremultiplyAlpha(clear)], [...clear]);
});
