import fs from 'fs';
import path from 'path';
import { WIN_CURSORS } from '../theme.js';
import { toSmart } from './windows.js';

const INSTALL_INF_TEMPLATE = `; Right click on this file in Windows Explorer and select "Install".
; Then, run \`main.cpl\` and select the cursor theme "{name}".

[Version]
Signature = "$CHICAGO$"

[DefaultInstall]
CopyFiles = Scheme.Cur
AddReg    = Scheme.Reg

[DestinationDirs]
Scheme.Cur = {root},"%CUR_DIR%"

[Scheme.Reg]
{hive},"{key}","%SCHEME_NAME%",,"{list}"

[Scheme.Cur]
{files}

[Strings]
CUR_DIR = "Cursors\\{name}"
SCHEME_NAME = "{name}"
{mapping}
`;

const UNINSTALL_INF_TEMPLATE = `; Right click on this file in Windows Explorer and select "Install" to
; delete this cursor theme from your computer fully.

[Version]
Signature = "$CHICAGO$"

[DefaultInstall]
DelFiles = Scheme.Cur
DelReg   = Scheme.Reg

[DestinationDirs]
Scheme.Cur = {root},"%CUR_DIR%"

[Scheme.Reg]
{hive},"{key}","%SCHEME_NAME%"

[Scheme.Cur]
{files}

[Strings]
CUR_DIR = "Cursors\\{name}"
SCHEME_NAME = "{name}"
`;

/**
 * Writes a Windows cursor theme (install.inf, uninstall.inf + cursor files) to a directory.
 *
 * @param {Object} theme - A theme object shaped like { name, arrow, help, ... }.
 * @param {string} directory - Directory where the theme should be written.
 * @param {boolean} [user=false] - Install for the current user only (HKCU + %AppData%).
 * @returns {Promise<void>}
 */
export async function exportWindowsTheme(theme, directory, user = false) {
    fs.mkdirSync(directory, { recursive: true });

    const files = [];
    const mapping = {};

    for (const name of WIN_CURSORS) {
        const cursor = theme[name];
        if (!cursor) continue;

        const [ext, result] = await toSmart(cursor.frames);
        const filename = `${name}${ext}`;
        fs.writeFileSync(path.join(directory, filename), result);

        files.push(filename);
        mapping[name] = filename;
    }

    // 16410 is %AppData%, 10 is %SystemRoot%
    const root = user ? 16410 : 10;
    const cursorList = WIN_CURSORS
        .map(name => (name in mapping ? `%${root}%\\%CUR_DIR%\\%${name}%` : ''))
        .join(',');
    const infMapping = Object.entries(mapping)
        .map(([key, value]) => `${key} = "${value}"`)
        .join('\n');

    const formatArgs = {
        root,
        hive: user ? 'HKCU' : 'HKLM',
        key: user ? 'Control Panel\\Cursors\\Schemes'
                  : 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Control Panel\\Cursors\\Schemes',
        name: theme.name || 'win2xcur',
        list: cursorList,
        mapping: infMapping,
        files: files.join('\n'),
    };

    const format = template => template
        .replaceAll('{root}', formatArgs.root)
        .replaceAll('{hive}', formatArgs.hive)
        .replaceAll('{key}', formatArgs.key)
        .replaceAll('{name}', formatArgs.name)
        .replaceAll('{list}', formatArgs.list)
        .replaceAll('{mapping}', formatArgs.mapping)
        .replaceAll('{files}', formatArgs.files);

    fs.writeFileSync(path.join(directory, 'install.inf'), format(INSTALL_INF_TEMPLATE));
    fs.writeFileSync(path.join(directory, 'uninstall.inf'), format(UNINSTALL_INF_TEMPLATE));
}
