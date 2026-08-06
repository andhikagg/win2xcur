#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { openBlob } from '../lib/parser/index.js';
import { toX11 } from '../lib/writer/index.js';
import { applyToFrames as applyScale, generateSizes } from '../lib/scale.js';
import { applyToFrames as applyShadow } from '../lib/shadow.js';
import { logger } from '../lib/logger.js';

program
    .description('Converts Windows cursors to X11 cursors.')
    .argument('[files...]', 'Windows cursor files to convert (*.cur, *.ani)')
    .option('-i, --input <file>', 'Input Windows cursor file to convert (alternative to positional argument)')
    .option('-o, --output <dir>', 'Directory to store converted cursor files.')
    .option('-s, --shadow', 'Whether to emulate Windows\'s shadow effect')
    .option('-O, --shadow-opacity <opacity>', 'Opacity of the shadow (0 to 100)', v => parseInt(v, 10), 50)
    .option('-r, --shadow-radius <radius>', 'Radius of shadow blur effect (as fraction of width)', parseFloat, 0.1)
    .option('-S, --shadow-sigma <sigma>', 'Sigma of shadow blur effect (as fraction of width)', parseFloat, 0.1)
    .option('-x, --shadow-x <x>', 'x-offset of shadow (as fraction of width)', parseFloat, 0.05)
    .option('-y, --shadow-y <y>', 'y-offset of shadow (as fraction of height)', parseFloat, 0.05)
    .option('-c, --shadow-color <color>', 'color of the shadow', '#000000')
    .option('--scale <scale>', 'Scale the cursor by the specified factor.', parseFloat)
    .option('--sizes <sizes>', 'Comma-separated list of sizes (e.g. 24,32,48,64) for X11 dynamic scaling.')
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
        logger.error(`[ERROR] Processing ${logger.highlight(filePath)}: Path is a directory. Please provide a file, or use 'win2xcurtheme' for folders.`);
        return;
    }

    try {
        const blob = fs.readFileSync(filePath);
        const cursor = await openBlob(blob);

        if (options.scale) {
            await applyScale(cursor.frames, options.scale);
        }

        if (options.sizes) {
            const targetSizes = options.sizes.split(',').map(s => parseInt(s.trim(), 10)).filter(s => !isNaN(s));
            if (targetSizes.length > 0) {
                await generateSizes(cursor.frames, targetSizes);
            }
        }

        if (options.shadow) {
            await applyShadow(cursor.frames, {
                color: options.shadowColor,
                radius: options.shadowRadius,
                sigma: options.shadowSigma,
                xoffset: options.shadowX,
                yoffset: options.shadowY,
                opacity: options.shadowOpacity
            });
        }

        const result = await toX11(cursor.frames);
        const outputName = path.basename(filePath, path.extname(filePath));
        const outputPath = path.join(outputDir, outputName);

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

    // Process files sequentially to avoid saturating memory/libvips with many huge files at once,
    // though Promise.all could be used for concurrency.
    for (const file of files) {
        await processFile(file, outputDir);
    }
}

main();
