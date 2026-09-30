<div align="center">

<img src="media/icon.png" width="112" alt="Code Root icon">

# Code Root

**Every project you own, one click away.**

Pick the folder where all your code lives. Code Root turns it into a sidebar of
projects you can open in this window or a new one, without ever touching a file dialog.

[![Version](https://img.shields.io/badge/version-0.2.0-3b82f6?style=flat-square)](CHANGELOG.md)
[![VS Code](https://img.shields.io/badge/VS%20Code-%E2%89%A51.80-007acc?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-0-a855f7?style=flat-square)](package.json)

[Install](#-install) · [Features](#-features) · [Shortcuts](#%EF%B8%8F-keyboard-shortcuts) · [Settings](#%EF%B8%8F-settings) · [Development](#-development)

</div>

---

## ✨ Features

| | |
| --- | --- |
| 🌳 **Project tree** | Category folders like `projects/ongoing` expand; projects open. Each project gets a stack icon and label. |
| 🪟 **Here or new window** | Click a project to open it here, or use the window button to open it in a new window. Folders open too. |
| 🕘 **Recent** | The projects you opened last sit at the top, even ones you opened from the terminal. |
| 🔍 **Find Project** | `Ctrl+Alt+O` searches every project under the root. `Enter` opens it here, `Ctrl+Enter` opens a new window. |
| ⌨️ **Shortcuts for everything** | Every action has a key, and every key can be remapped. |
| 📋 **Path tools** | Reveal in File Manager and Copy Path from the right-click menu or the keyboard. |
| 🪶 **Featherweight** | Plain JavaScript, no build step, no dependencies. |

### Knows your stack

Code Root recognizes a project by its files and labels it:

> Next.js · React · Vite · Vue · Svelte · TanStack Start · Expo · Electron · Node.js · Express ·
> NestJS · Django · Flask · FastAPI · Laravel · PHP · Go · Rust · C / C++ · Java · Flutter ·
> Chrome Ext · VS Code Ext · n8n · HTML / CSS · …

## 📦 Install

Download [`code-root-0.2.0.vsix`](code-root-0.2.0.vsix) from this repo, then either:

```bash
code --install-extension code-root-0.2.0.vsix
```

or in VS Code open the Extensions view, click **···** → **Install from VSIX…** and pick the file.

On first run the **Code Root** view in the activity bar asks you to choose your root folder.

## ⌨️ Keyboard shortcuts

Every shortcut can be changed. Click the **keyboard icon** at the top of the
Code Root sidebar (or press `Ctrl+K Ctrl+Alt+O`) to open the Keyboard Shortcuts
editor showing only Code Root's commands, then double-click one to rebind it.

**Anywhere**

| Action | Linux / Windows | macOS |
| --- | --- | --- |
| Find Project | `Ctrl+Alt+O` | `Cmd+Alt+O` |
| Show the Projects view | `Ctrl+Shift+Alt+O` | `Cmd+Shift+Alt+O` |
| Keyboard Shortcuts | `Ctrl+K Ctrl+Alt+O` | `Cmd+K Cmd+Alt+O` |

**Opening** (same keys in Find Project and the Projects view, so one remap changes both)

| Action | Linux / Windows | macOS |
| --- | --- | --- |
| Open Here | `Enter` | `Enter` |
| Open in New Window | `Ctrl+Enter` | `Cmd+Enter` |

In the Projects view these work on projects and folders; expand a folder with `→`.

**With the Projects view focused** (acts on the selected item)

| Action | Linux / Windows | macOS |
| --- | --- | --- |
| Reveal in File Manager | `Shift+Alt+R` | `Alt+Cmd+R` |
| Copy Path | `Shift+Alt+C` | `Alt+Cmd+C` |
| Remove from Recent | `Delete` | `Cmd+Backspace` |
| Clear Recent | `Ctrl+Shift+Delete` | `Cmd+Shift+Backspace` |
| Refresh | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Select Root Folder | `Ctrl+Shift+O` | `Cmd+Shift+O` |

<details>
<summary>Writing your own <code>keybindings.json</code> rules</summary>

<br>

`codeRoot.selection` holds the selected item's kind for `when` clauses:
`project`, `folder`, `project.recent`, `folder.recent`, `recentGroup` or `rootGroup`.
`codeRoot.finding` is true while Find Project is open.
`codeRoot.open` and `codeRoot.openNewWindow` act on the Find Project result
while it's open, otherwise on the tree selection.

```jsonc
{
  "key": "alt+enter",
  "command": "codeRoot.openNewWindow",
  "when": "focusedView == codeRoot.tree && codeRoot.selection == project"
}
```

</details>

## 🧭 What counts as a project

A folder is a **project** when any of these is true:

- it has files of its own, or a marker like `.git`, `package.json`, `manage.py`,
  `Cargo.toml`, `pubspec.yaml`, `index.html`, …
- it only holds parts like `frontend/` and `backend/`
- its name ends in stack tags, e.g. `shop-nextjs-nestjs` or `reply_pilot-chrome-ext`
  (shown as **shop** · Next.js · NestJS)

A folder that only holds other folders is a **category**.

```text
~/code                      ← root
├── projects/               ← category
│   ├── ongoing/            ← category
│   │   ├── shop-nextjs-nestjs    ← project · Next.js · NestJS
│   │   └── code_root-vscode-ext  ← project · VS Code Ext
│   └── completed/
└── notes/                  ← project · Notes
```

## ⚙️ Settings

| Setting | Default | Description |
| --- | --- | --- |
| `codeRoot.rootFolder` | — | The root folder. Per machine, so Settings Sync doesn't copy a Linux path to Windows. |
| `codeRoot.recentCount` | `5` | Projects in the Recent group; `0` hides it. |
| `codeRoot.exclude` | `node_modules`, `dist`, … | Folder names that are never listed. |
| `codeRoot.showHidden` | `false` | List folders whose name starts with a dot. |
| `codeRoot.searchDepth` | `5` | How many levels deep Find Project looks. |

## 🛠 Development

No build step and no dependencies: plain JavaScript in `src/`.

```bash
npm test          # scanner and stack tests, plain node
npm run package   # builds code-root-<version>.vsix
```

Press `F5` in VS Code to run it in an Extension Development Host.

```text
src/
├── extension.js   commands, Find Project, keybinding wiring
├── tree.js        sidebar tree view
├── scanner.js     project / category detection
├── stacks.js      stack icons and labels
├── recent.js      recent projects
└── config.js      settings
```

## 📄 License

[MIT](LICENSE)
