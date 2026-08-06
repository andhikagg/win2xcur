#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import { openBlob } from '../lib/parser/index.js';
import { logger } from '../lib/logger.js';

// Handle EPIPE errors gracefully when output is piped to tools like `head`
process.stdout.on('error', function( err ) {
    if (err.code === 'EPIPE') {
        process.exit(0);
    }
});

program
    .description('Inspects a cursor file.')
    .argument('[files...]', 'Cursor files to inspect')
    .option('-i, --input <file>', 'Input cursor file to inspect (alternative to positional argument)');

program.parse(process.argv);
const options = program.opts();
const files = program.args.length > 0 ? program.args : (options.input ? [options.input] : []);

if (files.length === 0) {
    logger.error('Error: No input files specified.');
    program.help();
}

async function processFile(filePath) {
    logger.info(`=== ${logger.highlight(filePath)} ===`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        logger.error(`[ERROR] Path is a directory. Please provide a cursor file.`);
        return;
    }

    try {
        const blob = fs.readFileSync(filePath);
        const cursor = await openBlob(blob);
        
        for (let i = 0; i < cursor.frames.length; i++) {
            const frame = cursor.frames[i];
            logger.text(`Frame ${i}: Delay ${frame.delay.toFixed(3)}s`);
            for (let j = 0; j < frame.images.length; j++) {
                const img = frame.images[j];
                const meta = await img.image.metadata();
                logger.text(`  Image ${j}: ${meta.width}x${meta.height}, nominal ${img.nominal}, hotspot [${img.hotspot[0]}, ${img.hotspot[1]}]`);
            }
        }
    } catch (e) {
        logger.error(`Error: ${e.message}`);
    }
    console.log('');
}

async function main() {
    for (const file of files) {
        await processFile(file);
    }
}

main();
