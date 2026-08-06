import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openBlob } from '../src/lib/parser/index.js';
import { applyToFrames } from '../src/lib/shadow.js';
import { toX11 } from '../src/lib/writer/x11.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plana = path.join(__dirname, 'plana');

test('shadow keeps the cursor parseable and preserves hotspot', async () => {
    const cursor = await openBlob(fs.readFileSync(path.join(plana, 'Person.cur')));
    const image = cursor.frames[0].images[0];

    await applyToFrames(cursor.frames, {
        color: '#000000', radius: 0.1, sigma: 0.1, xoffset: 0.05, yoffset: 0.05, opacity: 50
    });

    const x11 = await toX11(cursor.frames);
    assert.ok(x11.subarray(0, 4).equals(Buffer.from('Xcur')));

    const reparsed = await openBlob(x11);
    const shadowed = reparsed.frames[0].images[0];
    const metadata = await shadowed.image.metadata();
    assert.deepEqual(shadowed.hotspot, image.hotspot);
    assert.equal(shadowed.nominal, image.nominal);

    // The canvas should have expanded to make room for the shadow.
    assert.ok(metadata.width >= image.nominal);
    assert.ok(metadata.height >= image.nominal);
});

test('shadow opacity changes the rendered output', async () => {
    async function render(opacity) {
        const cursor = await openBlob(fs.readFileSync(path.join(plana, 'Person.cur')));
        await applyToFrames(cursor.frames, {
            color: '#000000', radius: 0.1, sigma: 0.1, xoffset: 0.05, yoffset: 0.05, opacity
        });
        return toX11(cursor.frames);
    }

    const subtle = await render(50);
    const dense = await render(100);
    assert.notDeepEqual(subtle, dense, 'opacity 100 should differ from 50');
});