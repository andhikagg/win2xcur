#!/usr/bin/env node

import inquirer from 'inquirer';
import { exec } from 'child_process';
import { logger } from '../lib/logger.js';

const tools = [
    { name: 'win2xcur: Convert a single Windows cursor to X11 format.', value: 'win2xcur' },
    { name: 'x2wincur: Convert a single X11 cursor to Windows format.', value: 'x2wincur' },
    { name: 'win2xcurtheme: Convert a Windows cursor theme to X11 format.', value: 'win2xcurtheme' },
    { name: 'x2wincurtheme: Convert an X11 cursor theme to Windows format.', value: 'x2wincurtheme' },
    { name: 'inspectcur: Inspect metadata of a cursor file.', value: 'inspectcur' }
];

async function main() {
    const { mode } = await inquirer.prompt([
        {
            type: 'select',
            name: 'mode',
            message: 'Which tool would you like to run?',
            choices: tools,
        },
    ]);

    const { inputPath } = await inquirer.prompt([
        {
            type: 'input',
            name: 'inputPath',
            message: mode.includes('theme') && mode !== 'win2xcurtheme' 
                        ? `Enter the input path (Directory) for ${mode}:` 
                        : mode === 'win2xcurtheme'
                            ? `Enter the input path (e.g. install.inf) for ${mode}:`
                            : `Enter the input path (File) for ${mode}:`,
            validate: (input) => input ? true : 'Input path cannot be empty.',
        },
    ]);

    let command = `npm run ${mode} -- -i "${inputPath}"`;
    
    if (mode !== 'inspectcur') {
        const { outputPath } = await inquirer.prompt([
            {
                type: 'input',
                name: 'outputPath',
                message: `Enter the output path for ${mode}:`,
                default: `./${mode}_out`,
            },
        ]);
        command += ` -o "${outputPath}"`;
    }

    if (mode === 'win2xcur' || mode === 'win2xcurtheme') {
        const { addSizes } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'addSizes',
                message: 'Do you want to generate multiple sizes for Linux DE scaling (e.g., 24,32,48)?',
                default: false,
            },
        ]);

        if (addSizes) {
            const { sizes } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'sizes',
                    message: 'Enter comma-separated sizes:',
                    default: '24,32,48,64',
                },
            ]);
            command += ` --sizes ${sizes}`;
        }
    }
    
    if (mode === 'win2xcur' || mode === 'win2xcurtheme') {
        const { addShadow } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'addShadow',
                message: 'Do you want to add a drop-shadow?',
                default: false,
            },
        ]);
        if (addShadow) {
            command += ` --shadow`;
        }
    }
    
    logger.info(`\n> Executing: ${logger.highlight(command)}\n`);

    const child = exec(command);
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    
    child.on('exit', (code) => {
        if (code === 0) {
            logger.success(`\nExecution finished successfully.`);
        } else {
            logger.error(`\nExecution finished with error code ${code}.`);
        }
    });
}

main().catch(e => logger.error(e.message));
