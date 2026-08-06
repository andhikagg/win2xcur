import fs from 'fs';
import path from 'path';
import { openBlob } from './index.js';
import { XCURSOR_ALIASES } from '../theme.js';

/**
 * Parses an Xcursor theme directory into a theme object.
 *
 * For every canonical cursor name in XCURSOR_ALIASES the first existing
 * candidate file in the directory is parsed. Returns a plain object shaped
 * like { name, arrow, help, ... } where each value is a BaseParser instance.
 *
 * @param {string} name - The name of the theme.
 * @param {string} directory - Path to the directory containing Xcursor files.
 * @returns {Promise<Object>}
 */
export async function parseXcursorTheme(name, directory) {
    const params = { name };

    const casefolded = {};
    for (const file of fs.readdirSync(directory)) {
        casefolded[file.toLowerCase()] = file;
    }

    for (const [cursorName, candidates] of Object.entries(XCURSOR_ALIASES)) {
        for (const candidate of candidates) {
            const actualName = casefolded[candidate.toLowerCase()];
            if (!actualName) continue;

            const fullPath = path.join(directory, actualName);
            if (!fs.statSync(fullPath).isFile()) continue;

            const blob = fs.readFileSync(fullPath);
            params[cursorName] = await openBlob(blob);
            break;
        }
    }

    return params;
}
