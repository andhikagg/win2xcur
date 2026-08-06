# win2xcur (Node.js)

A command-line tool suite to convert cursor themes between Windows (`.cur`, `.ani`) and Linux/X11 (`Xcursor`). 

> This is a **Node.js port** of the Python tool [quantum5/win2xcur](https://github.com/quantum5/win2xcur). All credit for the original concept and algorithms goes to the upstream project.

## Tools

- **`win2xcur`** — Converts cursors from Windows format (`*.cur`, `*.ani`) to Xcursor format. It preserves the cursor hotspot and animation delay, and has an optional mode (`-s`) that replicates Windows's cursor shadow effect.
- **`x2wincur`** — The reverse: converts cursors in Xcursor format to Windows format (`*.cur`, `*.ani`), allowing your favourite Linux cursor themes to be used on Windows.
- **`win2xcurtheme`** — Converts a packaged Windows cursor theme (with an `install.inf`) into a directory of Xcursors, ready to be used as a Linux cursor theme.
- **`x2wincurtheme`** — Converts a directory of Xcursors into a Windows theme, while generating a complementary `install.inf` (and `uninstall.inf` for removal).
- **`inspectcur`** — A debugging tool that loads arbitrary Windows or X11 cursors and shows the animation settings, image sizes, and hotspots.

## Installation and Usage

There are four ways to use these tools, separated by user type.

---

### For End-Users: Install Directly from GitHub
You can run or install this tool directly from its GitHub repository without cloning it:

**Method 1: Run without Installing (NPX)**
This is the easiest way. `npx` temporarily downloads and runs the package on the fly.
```bash
npx github:andhikagg/win2xcur win2xcurtheme -i path/to/install.inf
```

**Method 2: Install Globally from GitHub**
This installs the commands system-wide directly from the GitHub repo.
```bash
# Install directly from GitHub
npm install -g github:andhikagg/win2xcur

# Now the commands are available anywhere
win2xcurtheme -i path/to/install.inf
```
To uninstall: `npm uninstall -g win2xcur` (the name `win2xcur` is from `package.json`).

---

### For Developers: After Cloning the Repository
Use these methods if you have cloned the source code to your local machine for development.

**Method 3: Interactive CLI (`npm start`) - ✨ Recommended**
Don't want to memorize flags? Use the interactive wizard!
1.  **Install dependencies:** `npm install`
2.  **Start the wizard:**
    ```bash
    npm start
    ```
    This will prompt you to choose a tool, input paths, and options (like multi-size scaling or shadows) interactively.

**Method 4: Local Scripts (`npm run`)**
This is the standard, isolated way to run specific scripts directly.
```bash
npm run win2xcurtheme -- -i path/to/install.inf --sizes 24,32,48
```

**Method 5: Global Link (`npm link`)**
This simulates a global installation using your local source code, allowing you to use the commands anywhere without `npm run`.
1.  **Create the global link:** `npm link`
2.  **Use the commands globally:** `win2xcurtheme -i path/to/install.inf`
To unlink: `npm unlink` (run from the project directory).

---

## Usage Examples

All examples below assume you have installed the commands globally (via **Method 2** or **Method 4**).

### 1. Convert Full Theme (Windows ➔ Linux)
Reads an `install.inf` file and generates a drop-in ready Linux theme.

```bash
# Convert with auto-generated multi-sizes for XFCE/KDE scaling
win2xcurtheme -i ./path/to/install.inf --sizes 24,32,48,64

# (Output folder defaults to [ThemeName]_out if -o is not provided)
```

### 2. Reverse Theme (Linux ➔ Windows)
Converts a Linux theme folder back to a Windows theme, auto-generating a new `install.inf` (and `uninstall.inf` for easy removal).

```bash
x2wincurtheme -i ./theme_x11_folder -o ./win_theme_output -n "Theme Name"
# Optional: install for the current user only (HKCU + %AppData%) instead of system-wide
x2wincurtheme -i ./theme_x11_folder -o ./win_theme_output -n "Theme Name" --user
```

### 3. Convert Single File
Translate individual cursor files.

```bash
# Windows to Linux
win2xcur -i cursor.cur -o ./output

# Linux to Windows
x2wincur -i linux_cursor -o ./output
```

### 4. Inspect Cursor Metadata
View frames, animation delays, dimensions, and hotsuser
```

### 3. Convert Single File
Translate individual cursor files.

```bash
# Windows to Linux
win2xcur -i cursor.cur -o ./output

# Linux to Windows
x2wincur -i linux_cursor -o ./output
```

### 4. Inspect Cursor Metadata
View frames, animation delays, dimensions, and hotspot coordinates.
```bash
inspectcur -i cursor.ani
```

Example output:
```console
$ inspectcur /usr/share/icons/DMZ-White/cursors/left_ptr
Cursor file: /usr/share/icons/DMZ-White/cursors/left_ptr
1. nominal size 24, 24x24, hotspot: (7, 4)
2. nominal size 32, 32x32, hotspot: (10, 5)
3. nominal size 48, 48x48, hotspot: (14, 8)
$ inspectcur /usr/share/icons/DMZ-White/cursors/watch
Cursor file: /usr/share/icons/DMZ-White/cursors/watch
  - Frame 0, delay 30.0 ms
    1. nominal size 24, 24x24, hotspot: (12, 12)
    2. nominal size 32, 32x32, hotspot: (18, 18)
    3. nominal size 48, 48x48, hotspot: (24, 24)
  - Frame 1, delay 30.0 ms
    1. nominal size 24, 24x24, hotspot: (12, 12)
    2. nominal size 32, 32x32, hotspot: (18, 18)
    3. nominal size 48, 48x48, hotspot: (24, 24)
...
```

## Flags Reference

Most tools accept positional arguments as inputs, but you can also use the `-i` or `--input` flag explicitly to avoid confusion.

| Flag | Description | Applicable Tools |
|---|---|---|
| `-i, --input <path>` | Specifies the input file or folder. | All |
| `-o, --output <dir>` | Specifies the output directory. Defaults to a generated name if omitted on theme commands. | All (except `inspectcur`) |
| `-q, --quiet` | Suppress all non-error output logs. | All (except `inspectcur`) |
| `--sizes <list>` | Comma-separated sizes (e.g., `24,32,48,64`) for dynamic UI scaling generation. | `win2xcur`, `win2xcurtheme` |
| `--scale <float>` | Uniformly scale all images and hotspots by a static multiplier. | All (except `inspectcur`) |
| `--no-theme` | Output raw files directly without wrapping them in `index.theme` or `cursors/`. | `win2xcurtheme` |
| `-n, --name <name>` | Custom theme name for the generated `install.inf`. | `x2wincurtheme` |
| `-u, --user`, `--hkcu` | Install the theme for the current user only (uses `HKCU` + `%AppData%` instead of `HKLM` + `%SystemRoot%`). | `x2wincurtheme` |
| `--align-sizes` | Align image sizes to the Windows default cursor sizes (`32,48,64,96,128,256`) by extending the canvas with transparency (warns if content would be cropped). | `x2wincur`, `x2wincurtheme` |
| `-s, --shadow` | Emulates the classic Windows drop-shadow on the cursor image. | `win2xcur`, `win2xcurtheme` |
| `--shadow-color <hex>` | Color of the shadow. Default: `#000000` | `win2xcur`, `win2xcurtheme` |
| `--shadow-opacity <val>` | Opacity of the shadow (0 to 100). Default: `50` | `win2xcur`, `win2xcurtheme` |
| `--shadow-radius <val>` | Radius of shadow blur effect (as fraction of width). Default: `0.1` | `win2xcur`, `win2xcurtheme` |
| `--shadow-sigma <val>` | Sigma of shadow blur effect (as fraction of width). Default: `0.1` | `win2xcur`, `win2xcurtheme` |
| `--shadow-x <val>` | X-offset of shadow (as fraction of width). Default: `0.05` | `win2xcur`, `win2xcurtheme` |
| `--shadow-y <val>` | Y-offset of shadow (as fraction of height). Default: `0.05` | `win2xcur`, `win2xcurtheme` |

## Troubleshooting

`win2xcur`, `x2wincur`, `win2xcurtheme`, and `x2wincurtheme` should work out of the box on most systems. This port uses [`sharp`](https://sharp.pixelplumbing.com/) (libvips) for image processing instead of ImageMagick/Wand; if you run into `sharp` or `libvips` related errors, make sure the correct prebuilt binaries for your platform were installed during `npm install`.

If you are having issues with a particular cursor or cursor theme, feel free to open an issue. However, be sure to include:

1. **the problematic cursor as an attachment** to the issue;
2. the command you ran; and
3. the full output of the command run.

If we can't reproduce the issue, we will not be able to help you.
