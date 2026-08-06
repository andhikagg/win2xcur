#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { openBlob } from '../lib/parser/index.js';
import { toSmart } from '../lib/writer/index.js';
import { applyToFrames as applyScale } from '../lib/scale.js';
import { applyToFrames as applyAlign } from '../lib/align.js';
import { logger } from '../lib/logger.js';

program
    .description('Converts X11 cursors to Windows cursors.')
    .argument('[files...]', 'X11 cursor files to convert')
    .option('-i, --input <file>', 'Input X11 cursor file to convert')
    .option('-o, --output <dir>', 'Directory to store converted cursor files.')
    .option('--scale <scale>', 'Scale the cursor by the specified factor.', parseFloat)
    .option('--align-sizes', 'Align image sizes to Windows default cursor sizes.')
    .option('-q, --quiet', 'Suppress all non-error output.');

program.parse(process.argv);

const options = program.opts();
const files = program.args.length > 0 ? program.args : (options.input ? [options.input] : []);

if (files.length === 0) {
    logger.error('Error: No input files specified.');
    program.help();
}

async function processFile(filePath, outputDir) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        logger.error(`[ERROR] Processing ${logger.highlight(filePath)}: Path is a directory. Please provide a file, or use 'x2wincurtheme' for folders.`);
        return;
    }

    try {
        const blob = fs.readFileSync(filePath);
        const cursor = await openBlob(blob);

        if (options.scale) {
            await applyScale(cursor.frames, options.scale);
        }

        if (options.alignSizes) {
            await applyAlign(cursor.frames, filePath);
        }

        const [ext, result] = await toSmart(cursor.frames);
        
        const outputName = path.basename(filePath, path.extname(filePath));
        const outputPath = path.join(outputDir, outputName + ext);

        fs.writeFileSync(outputPath, result);
        if (!options.quiet) {
            logger.success(`[SUCCESS] Convert: ${logger.highlight(filePath)} > ${logger.highlight(outputPath)}`);
        }
    } catch (e) {
        logger.error(`[ERROR] Processing ${logger.highlight(filePath)}:`);
        console.error(e);
    }
}

async function main() {
    if (files.length === 0) {
        logger.error('Error: No input files specified.');
        program.help();
    }

    const outputDir = options.output || `${path.basename(files[0], path.extname(files[0]))}_out`;
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const file of files) {
        await processFile(file, outputDir);
    }
}

main();
