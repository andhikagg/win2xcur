import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openBlob } from '../src/lib/parser/index.js';
import { parseInf } from '../src/lib/parser/inf.js';
import { parseXcursorTheme } from '../src/lib/parser/xtheme.js';
import { toX11 } from '../src/lib/writer/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plana = path.join(__dirname, 'plana');

function readPlana(file) {
    return fs.readFileSync(path.join(plana, file));
}

test('openBlob parses a .cur file', async () => {
    const cursor = await openBlob(readPlana('Person.cur'));
    assert.equal(cursor.frames.length, 1);
    assert.equal(cursor.frames[0].images.length, 1);

    const image = cursor.frames[0].images[0];
    const metadata = await image.image.metadata();
    assert.equal(metadata.width, 42);
    assert.equal(metadata.height, 42);
    assert.deepEqual(image.hotspot, [10, 9]);
    assert.equal(image.nominal, 42);
});

test('openBlob parses a .cur file with multiple sizes', async () => {
    const cursor = await openBlob(readPlana('Pin.cur'));
    assert.equal(cursor.frames.length, 1);
    assert.equal(cursor.frames[0].images.length, 1);

    const image = cursor.frames[0].images[0];
    const metadata = await image.image.metadata();
    assert.equal(metadata.width, 36);
    assert.deepEqual(image.hotspot, [10, 6]);
});

test('openBlob parses an .ani file', async () => {
    const cursor = await openBlob(readPlana('Normal.ani'));
    assert.equal(cursor.frames.length, 16);

    for (const frame of cursor.frames) {
        assert.ok(Math.abs(frame.delay - 0.1) < 1e-9);
        assert.equal(frame.images.length, 1);

        const metadata = await frame.images[0].image.metadata();
        assert.equal(metadata.width, 32);
        assert.equal(metadata.height, 32);
        assert.deepEqual(frame.images[0].hotspot, [1, 1]);
    }
});

test('openBlob rejects unsupported formats', async () => {
    await assert.rejects(openBlob(Buffer.from('not a cursor')), /Unsupported file format/);
});

test('parseInf reads a Windows cursor theme INF', async () => {
    const theme = await parseInf(path.join(plana, 'install.inf'));
    assert.equal(theme.name, 'Plana');
    assert.ok(theme.arrow, 'arrow cursor should be present');
    assert.equal(theme.arrow.frames.length, 16);

    assert.ok(theme.location, 'location (pin) cursor should be present');
    const locationImage = theme.location.frames[0].images[0];
    assert.deepEqual(locationImage.hotspot, [10, 6]);

    assert.ok(theme.person, 'person cursor should be present');
    const personImage = theme.person.frames[0].images[0];
    const metadata = await personImage.image.metadata();
    assert.equal(metadata.width, 42);
});

test('parseXcursorTheme finds cursor files by XCURSOR_ALIASES', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'win2xcur-xtheme-'));

    // Build a minimal Xcursor theme directory with a single "arrow" file.
    const person = await openBlob(readPlana('Person.cur'));
    const x11 = await toX11(person.frames);
    fs.writeFileSync(path.join(tmp, 'arrow'), x11);
    fs.writeFileSync(path.join(tmp, 'person'), x11);

    const theme = await parseXcursorTheme('Test', tmp);
    assert.equal(theme.name, 'Test');
    assert.ok(theme.arrow, 'arrow should be found');
    assert.ok(theme.person, 'person should be found');
    assert.equal(theme.help, undefined, 'unmatched cursors should be undefined');

    const image = theme.arrow.frames[0].images[0];
    const metadata = await image.image.metadata();
    assert.equal(metadata.width, 42);
    assert.deepEqual(image.hotspot, [10, 9]);

    fs.rmSync(tmp, { recursive: true, force: true });
});
