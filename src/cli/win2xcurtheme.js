#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { parseInf, parseHeuristic } from '../lib/parser/inf.js';
import { XCURSOR_ALIASES, WIN_CURSORS } from '../lib/theme.js';
import { toX11 } from '../lib/writer/index.js';
import { applyToFrames as applyScale, generateSizes } from '../lib/scale.js';
import { applyToFrames as applyShadow } from '../lib/shadow.js';
import { logger } from '../lib/logger.js';

program
    .description('Converts Windows cursor themes to X11 ones.')
    .argument('[inf]', 'Windows cursor theme to convert (*.inf or directory)')
    .option('-i, --input <inf>', 'Input Windows cursor theme to convert (*.inf or directory)')
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
    .option('--no-theme', 'Do not generate index.theme and cursors/ folder, output directly to the output directory.')
    .option('-q, --quiet', 'Suppress all non-error output.');

program.parse(process.argv);

const options = program.opts();
const inputPath = options.input || program.args[0];

async function main() {
    if (!inputPath) {
        logger.error('Error: No input path specified.');
        program.help();
    }

    if (!fs.existsSync(inputPath)) {
        logger.error(`Input path not found: ${logger.highlight(inputPath)}`);
        process.exit(1);
    }

    let theme;
    let finalInfPath = inputPath;

    try {
        if (fs.statSync(inputPath).isDirectory()) {
            const files = fs.readdirSync(inputPath);
            const infFiles = files.filter(f => f.toLowerCase().endsWith('.inf'));
            
            if (infFiles.length === 1) {
                finalInfPath = path.join(inputPath, infFiles[0]);
                if (!options.quiet) logger.info(`[INFO] Auto-detected INF file: ${logger.highlight(finalInfPath)}`);
                theme = await parseInf(finalInfPath);
            } else if (infFiles.length > 1) {
                const preferred = infFiles.find(f => f.toLowerCase() === 'install.inf' || f.toLowerCase() === 'installer.inf');
                if (preferred) {
                    finalInfPath = path.join(inputPath, preferred);
                    if (!options.quiet) logger.info(`[INFO] Auto-detected multiple INF files, selected: ${logger.highlight(finalInfPath)}`);
                    theme = await parseInf(finalInfPath);
                } else {
                    logger.error(`[ERROR] Multiple INF files found in ${logger.highlight(inputPath)}. Please specify the exact file.`);
                    process.exit(1);
                }
            } else {
                theme = await parseHeuristic(inputPath);
                finalInfPath = inputPath;
            }
        } else {
            theme = await parseInf(inputPath);
        }

        if (!theme.arrow && !theme.default) {
            logger.error(`[ERROR] Basic pointer cursor not found in theme: ${logger.highlight(inputPath)}`);
            process.exit(1);
        }

        const defaultOutName = (theme.name || path.basename(finalInfPath, path.extname(finalInfPath))).replace(/[^a-zA-Z0-9]/g, '_');
        const outputDir = options.output || `${defaultOutName}_out`;

        let cursorsDir = outputDir;
        if (!fs.existsSync(cursorsDir)) {
            fs.mkdirSync(cursorsDir, { recursive: true });
        }

        if (options.theme !== false) {
            cursorsDir = path.join(outputDir, 'cursors');
            if (!fs.existsSync(cursorsDir)) {
                fs.mkdirSync(cursorsDir, { recursive: true });
            }

            const indexThemePath = path.join(outputDir, 'index.theme');
            const themeName = theme.name || 'win2xcur';
            const indexThemeContent = `[Icon Theme]\nName=${themeName}\nComment=Converted by win2xcur-node\n`;
            fs.writeFileSync(indexThemePath, indexThemeContent);
        }

        for (const name of Object.keys(XCURSOR_ALIASES)) {
            const cursor = theme[name];
            if (!cursor) continue;

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
            const aliases = XCURSOR_ALIASES[name];
            const canonical = aliases[0];
            const canonicalPath = path.join(cursorsDir, canonical);
            
            fs.writeFileSync(canonicalPath, result);
            if (!options.quiet) {
                logger.success(`[SUCCESS] Convert: ${cursor.blob.length} bytes > ${logger.highlight(canonicalPath)}`);
            }

            for (let i = 1; i < aliases.length; i++) {
                const aliasPath = path.join(cursorsDir, aliases[i]);
                if (process.platform !== 'win32') {
                    try {
                        fs.symlinkSync(canonical, aliasPath);
                        if (!options.quiet) logger.success(`[SUCCESS] Symlink: ${logger.highlight(aliasPath)} -> ${canonical}`);
                    } catch (e) {
                        if (e.code === 'EEXIST') {
                            fs.unlinkSync(aliasPath);
                            fs.symlinkSync(canonical, aliasPath);
                            if (!options.quiet) logger.success(`[SUCCESS] Symlink: ${logger.highlight(aliasPath)} -> ${canonical}`);
                        } else {
                            throw e;
                        }
                    }
                } else {
                    fs.copyFileSync(canonicalPath, aliasPath);
                    if (!options.quiet) logger.success(`[SUCCESS] Copy: ${logger.highlight(aliasPath)} -> ${canonical}`);
                }
            }
        }
        
        if (!options.quiet) {
            logger.success(`\nSuccessfully converted theme to ${logger.highlight(outputDir)}`);
        }
    } catch (e) {
        logger.error(`Error: ${e.message}`);
        console.error(e.stack);
    }
}

main();
