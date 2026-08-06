import fs from 'fs';
import path from 'path';
import ini from 'ini';
import { openBlob } from './index.js';
import { WIN_CURSORS } from '../theme.js';
import { logger } from '../logger.js';

function expandRegistry(text, strings) {
    if (!text) return '';
    
    // Create a lowercase lookup map for strings
    const lowerStrings = {};
    for (const key of Object.keys(strings)) {
        lowerStrings[key.toLowerCase()] = strings[key];
    }

    return text.replace(/%(\w*)%/g, (match, p1) => {
        if (!p1) return '%';
        const lowerKey = p1.toLowerCase();
        if (lowerStrings[lowerKey]) return lowerStrings[lowerKey].replace(/^"|"$/g, '');
        return match;
    });
}

export async function parseHeuristic(dirPath) {
    logger.info(`[INFO] No INF file found. Attempting heuristic auto-matching...`);
    const files = fs.readdirSync(dirPath);
    const casefolded = {};
    for (const file of files) {
        casefolded[file.toLowerCase()] = file;
    }

    const heuristics = {
        'arrow': ['arrow', 'normal', 'pointer', '01-normal', 'default'],
        'help': ['help', '04-help'],
        'working': ['working', 'appstarting', '03-loading', 'half-busy', 'background'],
        'wait': ['wait', 'busy', 'watch'],
        'crosshair': ['cross', 'crosshair', 'precision', '07-precision'],
        'text': ['text', 'ibeam', '05-text select', '05-text'],
        'pen': ['pen', 'handwriting', '06-handwriting', 'pencil'],
        'unavailable': ['unavailable', 'no', '08-unavailable', 'not-allowed', 'forbidden'],
        'size_ns': ['ns', 'size_ns', 'sizens', 'vert', 'vertical', '11-vertical resize', '11-vertical'],
        'size_ew': ['ew', 'size_ew', 'sizeew', 'horz', 'horizontal', '12-horizontal resize', '12-horizontal'],
        'size_nwse': ['nwse', 'size_nwse', 'sizenwse', 'dgn1', 'diagonal1', '13-diagonal resize 1', '13-diagonal 1'],
        'size_nesw': ['nesw', 'size_nesw', 'sizenesw', 'dgn2', 'diagonal2', '14-diagonal resize 2', '14-diagonal 2'],
        'move': ['move', 'sizeall', 'size_all', '15-move'],
        'up_arrow': ['up', 'uparrow', 'up_arrow', 'alternate', '16-alternate select', '16-alternate'],
        'link': ['link', 'hand', '02-link'],
        'location': ['location', 'pin', '09-location select', '09-location'],
        'person': ['person', '10-person select', '10-person']
    };

    const params = { name: path.basename(dirPath) };

    for (const [cursorName, guesses] of Object.entries(heuristics)) {
        let matchedFile = null;
        for (const guess of guesses) {
            if (casefolded[`${guess}.ani`]) {
                matchedFile = casefolded[`${guess}.ani`];
                break;
            }
            if (casefolded[`${guess}.cur`]) {
                matchedFile = casefolded[`${guess}.cur`];
                break;
            }
        }

        if (matchedFile) {
            logger.success(`[INFO] Auto-matched '${logger.highlight(cursorName)}' -> ${logger.highlight(matchedFile)}`);
            try {
                const cursorBlob = fs.readFileSync(path.join(dirPath, matchedFile));
                params[cursorName] = await openBlob(cursorBlob);
            } catch (e) {
                logger.warn(`[WARNING] Failed to parse ${logger.highlight(matchedFile)}: ${e.message}`);
            }
        } else {
            logger.warn(`[WARNING] Could not auto-detect cursor for '${logger.highlight(cursorName)}'. Skipping.`);
        }
    }
    return params;
}

export async function parseInf(infPath) {
    const content = fs.readFileSync(infPath, 'utf8');
    const parsed = ini.parse(content);

    const defaultInstall = parsed.DefaultInstall || parsed.defaultinstall;
    if (!defaultInstall || !defaultInstall.AddReg) {
        throw new Error('Unable to find registry update section in INF');
    }

    const regSections = (Array.isArray(defaultInstall.AddReg) ? defaultInstall.AddReg : defaultInstall.AddReg.split(',')).map(s => s.trim());
    
    let updates = [];
    for (const section of regSections) {
        const secData = parsed[section];
        if (secData) {
            if (Array.isArray(secData)) {
                updates.push(...secData);
            } else {
                for (const key of Object.keys(secData)) {
                    // ini package parses arrays or key-value pairs depending on format
                    // sometimes lines are just comma separated without =
                    if (secData[key] === true) {
                        updates.push(key);
                    } else {
                        updates.push(`${key}=${secData[key]}`);
                    }
                }
            }
        }
    }
    
    // In many inf files, the AddReg entries look like:
    // HKCU,"Control Panel\Cursors\Schemes","ThemeName",,"%10%\CursorFolder\arrow.cur,%10%\CursorFolder\help.cur,..."
    // Because `ini` might have trouble with commas in keys, let's just do a simple regex on the raw file content for AddReg lines
    
    const lines = content.split('\n');
    const installLines = lines.filter(line => {
        const lower = line.toLowerCase();
        return lower.startsWith('hkcu,"control panel\\cursors\\schemes",') || 
               lower.startsWith('hklm,"software\\microsoft\\windows\\currentversion\\control panel\\cursors\\schemes",');
    });

    if (installLines.length === 0) {
        throw new Error('No cursor installs found in INF');
    }
    if (installLines.length > 1) {
        throw new Error('Multiple cursor installs found in INF');
    }

    const strings = parsed.Strings || parsed.strings || {};
    
    // Parse the CSV-like line
    // e.g. HKCU,"Control Panel\Cursors\Schemes","My Theme",,"arrow.cur,help.cur,..."
    const csvPattern = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
    let matches = [];
    let match;
    while ((match = csvPattern.exec(installLines[0])) !== null) {
        matches.push(match[1] !== undefined ? match[1] : match[2]);
    }

    const root = matches[0];
    const regPath = matches[1];
    const name = matches[2];
    const flags = matches[3];
    const value = matches.slice(4).join(','); // The rest is the value

    const params = { name: expandRegistry(name, strings) };
    const cursorPaths = expandRegistry(value, strings).split(',');

    const infDir = path.dirname(infPath);
    const casefolded = {};
    for (const file of fs.readdirSync(infDir)) {
        casefolded[file.toLowerCase()] = file;
    }

    for (let i = 0; i < WIN_CURSORS.length; i++) {
        const cursorName = WIN_CURSORS[i];
        const filename = cursorPaths[i];
        
        if (!filename) continue;

        // Use a regex to extract the basename, mimicking Python's ntpath.basename
        const basename = filename.split(/[\/\\]/).pop();
        const actualName = casefolded[basename.toLowerCase()];
        
        if (!actualName) {
            console.warn(`[Warning] Expected cursor file not found in theme: ${basename}. Skipping.`);
            continue;
        }

        try {
            const cursorBlob = fs.readFileSync(path.join(infDir, actualName));
            params[cursorName] = await openBlob(cursorBlob);
        } catch (e) {
            console.warn(`[Warning] Failed to read or parse cursor file ${actualName}: ${e.message}. Skipping.`);
            continue;
        }
    }

    return params;
}
