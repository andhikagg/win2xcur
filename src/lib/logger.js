// Pastel ANSI Color Codes (24-bit RGB)
const RESET = '\x1b[0m';
const PASTEL_GREEN = '\x1b[38;2;119;221;119m';
const PASTEL_BLUE = '\x1b[38;2;174;198;207m';
const PASTEL_YELLOW = '\x1b[38;2;253;253;150m';
const PASTEL_RED = '\x1b[38;2;255;105;97m';
const PASTEL_PURPLE = '\x1b[38;2;203;153;201m';
const PASTEL_GRAY = '\x1b[38;2;207;207;196m';

export const logger = {
    success: (msg) => console.log(`${PASTEL_GREEN}${msg}${RESET}`),
    info: (msg) => console.log(`${PASTEL_BLUE}${msg}${RESET}`),
    warn: (msg) => console.warn(`${PASTEL_YELLOW}${msg}${RESET}`),
    error: (msg) => console.error(`${PASTEL_RED}${msg}${RESET}`),
    text: (msg) => console.log(`${PASTEL_GRAY}${msg}${RESET}`),
    highlight: (msg) => `${PASTEL_PURPLE}${msg}${RESET}`
};
