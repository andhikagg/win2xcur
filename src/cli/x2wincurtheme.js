#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { parseXcursorTheme } from '../lib/parser/xtheme.js';
import { exportWindowsTheme } from '../lib/writer/inf.js';
import { applyToFrames as applyScale } from '../lib/scale.js';
import { applyToFrames as applyAlign } from '../lib/align.js';
import { XCURSOR_ALIASES } from '../lib/theme.js';
import { logger } from '../lib/logger.js';

program
    .description('Converts X11 cursor themes to Windows ones.')
    .argument('[dir]', 'X11 cursor theme to convert (directory)')
    .option('-i, --input <dir>', 'Input X11 cursor theme to convert (directory)')
    .option('-o, --output <dir>', 'Directory to store converted cursor files.')
    .option('-n, --name <name>', 'Name of the Windows cursor theme.', 'win2xcur')
    .option('-u, --user', 'Install cursors for the current user only.')
    .option('--hkcu', 'Alias for --user.')
    .option('--scale <scale>', 'Scale the cursor by the specified factor.', parseFloat)
    .option('--align-sizes', 'Align image sizes to Windows default cursor sizes.')
    .option('-q, --quiet', 'Suppress all non-error output.');

program.parse(process.argv);

const options = program.opts();
let dirPath = options.input || program.args[0];

async function main() {
    if (!dirPath) {
        logger.error('Error: No input directory specified.');
        program.help();
    }

    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        logger.error(`Theme directory not found: ${logger.highlight(dirPath)}`);
        process.exit(1);
    }

    // Automatically use the 'cursors' subdirectory if it exists
    if (fs.existsSync(path.join(dirPath, 'cursors'))) {
        dirPath = path.join(dirPath, 'cursors');
    }

    const outputDir = options.output || `${path.basename(dirPath === '.' ? process.cwd() : dirPath)}_out`;

    try {
        const theme = await parseXcursorTheme(options.name, dirPath);

        if (!theme.arrow) {
            logger.error(`[ERROR] Basic pointer cursor not found in theme: ${logger.highlight(dirPath)}`);
            process.exit(1);
        }

        if (options.scale) {
            for (const name of Object.keys(XCURSOR_ALIASES)) {
                const cursor = theme[name];
                if (cursor) {
                    await applyScale(cursor.frames, options.scale);
                }
            }
        }

        if (options.alignSizes) {
            for (const name of Object.keys(XCURSOR_ALIASES)) {
                const cursor = theme[name];
                if (cursor) {
                    await applyAlign(cursor.frames, name);
                }
            }
        }

        await exportWindowsTheme(theme, outputDir, options.user || options.hkcu);
        if (!options.quiet) {
            logger.success(`\nSuccessfully generated Windows theme '${logger.highlight(options.name)}' in ${logger.highlight(outputDir)}`);
        }
    } catch (e) {
        logger.error(`Error: ${e.message}`);
        console.error(e.stack);
    }
}

main();
