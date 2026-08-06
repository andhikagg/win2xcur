import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openBlob } from '../src/lib/parser/index.js';
import { parseXcursorTheme } from '../src/lib/parser/xtheme.js';
import { toX11 } from '../src/lib/writer/x11.js';
import { toSmart } from '../src/lib/writer/windows.js';
import { exportWindowsTheme } from '../src/lib/writer/inf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plana = path.join(__dirname, 'plana');

function readPlana(file) {
    return fs.readFileSync(path.join(plana, file));
}

test('cur -> x11 -> cur roundtrip preserves hotspot and dimensions', async () => {
    const original = await openBlob(readPlana('Person.cur'));

    const x11 = await toX11(original.frames);
    const parsed = await openBlob(x11);

    const [ext, cur] = await toSmart(parsed.frames);
    assert.equal(ext, '.cur');

    const roundtripped = await openBlob(cur);
    const image = roundtripped.frames[0].images[0];
    const metadata = await image.image.metadata();
    assert.equal(metadata.width, 42);
    assert.equal(metadata.height, 42);
    assert.deepEqual(image.hotspot, [10, 9]);
});

test('ani -> x11 -> ani roundtrip preserves frame count and delays', async () => {
    const original = await openBlob(readPlana('Normal.ani'));

    const x11 = await toX11(original.frames);
    const parsed = await openBlob(x11);

    const [ext, ani] = await toSmart(parsed.frames);
    assert.equal(ext, '.ani');

    const roundtripped = await openBlob(ani);
    assert.equal(roundtripped.frames.length, 16);
    for (const frame of roundtripped.frames) {
        assert.ok(Math.abs(frame.delay - 0.1) < 1e-9);
    }
});

test('exportWindowsTheme writes install.inf and cursor files', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'win2xcur-theme-'));

    const person = await openBlob(readPlana('Person.cur'));
    const theme = { name: 'MyTheme', arrow: person, person };

    await exportWindowsTheme(theme, tmp);

    const infPath = path.join(tmp, 'install.inf');
    const inf = fs.readFileSync(infPath, 'utf8');
    assert.ok(inf.includes('MyTheme'), 'theme name should appear in INF');
    assert.ok(inf.includes('arrow.cur'), 'INF should reference arrow.cur');
    assert.ok(inf.includes('person.cur'), 'INF should reference person.cur');
    assert.ok(inf.includes('HKLM'), 'default install should target HKLM');
    assert.ok(!inf.includes('16410'), 'default install should not use %AppData%');

    const uninstallPath = path.join(tmp, 'uninstall.inf');
    const uninstall = fs.readFileSync(uninstallPath, 'utf8');
    assert.ok(uninstall.includes('MyTheme'), 'uninstall INF should reference theme name');
    assert.ok(uninstall.includes('DelFiles'), 'uninstall INF should delete files');
    assert.ok(uninstall.includes('DelReg'), 'uninstall INF should delete registry keys');

    const arrowPath = path.join(tmp, 'arrow.cur');
    assert.ok(fs.existsSync(arrowPath), 'arrow.cur should be written');
    const parsed = await openBlob(fs.readFileSync(arrowPath));
    const image = parsed.frames[0].images[0];
    const metadata = await image.image.metadata();
    assert.equal(metadata.width, 42);
    assert.deepEqual(image.hotspot, [10, 9]);

    fs.rmSync(tmp, { recursive: true, force: true });
});

test('exportWindowsTheme supports per-user install mode', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'win2xcur-theme-user-'));

    const person = await openBlob(readPlana('Person.cur'));
    const theme = { name: 'UserTheme', arrow: person };

    await exportWindowsTheme(theme, tmp, true);

    const install = fs.readFileSync(path.join(tmp, 'install.inf'), 'utf8');
    assert.ok(install.includes('HKCU'), 'user install should target HKCU');
    assert.ok(!install.includes('HKLM'), 'user install should not target HKLM');
    assert.ok(install.includes('16410'), 'user install should use %AppData%');
    assert.ok(install.includes('Control Panel\\Cursors\\Schemes'));

    const uninstall = fs.readFileSync(path.join(tmp, 'uninstall.inf'), 'utf8');
    assert.ok(uninstall.includes('HKCU'));
    assert.ok(uninstall.includes('16410'));

    fs.rmSync(tmp, { recursive: true, force: true });
});

test('x2wincurtheme pipeline: xcursor theme -> windows theme -> parseable INF', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'win2xcur-pipeline-'));

    // Build an Xcursor theme directory.
    const person = await openBlob(readPlana('Person.cur'));
    const x11 = await toX11(person.frames);
    fs.writeFileSync(path.join(tmp, 'arrow'), x11);
    fs.writeFileSync(path.join(tmp, 'person'), x11);

    const theme = await parseXcursorTheme('Test', tmp);
    await exportWindowsTheme(theme, tmp);

    const inf = fs.readFileSync(path.join(tmp, 'install.inf'), 'utf8');
    assert.ok(inf.includes('Test'));
    assert.ok(inf.includes('arrow.cur'));

    // The generated theme must be readable again with parseInf.
    const reparsed = await parseXcursorTheme('Test', tmp);
    assert.ok(reparsed.arrow);

    fs.rmSync(tmp, { recursive: true, force: true });
});
