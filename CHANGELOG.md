# Changelog

## 0.4.0

- **Rename**: `F2` or **Rename…** in the right-click menu renames a folder or project. The name
  is pre-selected without its stack suffix (`shop` in `shop-nextjs`). Recent entries follow the
  rename, including projects inside a renamed folder. Renaming the folder this window has open
  asks first, then reopens the window at the new name. `/` is refused (this renames, it doesn't
  move); a case-only change is allowed.

## 0.3.0

- **New Folder**: a button at the top of the sidebar and on the root folder, **New Folder…** in the
  right-click menu, and `Shift+Alt+N` in the Projects view. It creates inside the selected folder
  (or the root), or next to a selected project. `a/b` makes nested folders. Names that already
  exist or that Windows can't use are refused as you type. The new folder is selected in the tree
  and can be opened here or in a new window straight away.

## 0.2.0

- Keyboard shortcuts for every command, all remappable in the Keyboard Shortcuts editor.
- Tree commands work from the keyboard on the selected item.
- New **Keyboard Shortcuts** command opens the editor filtered to Code Root; it's a button in the sidebar view.
- Find Project results have Open Here and Open in New Window buttons.
- Open Here is `Enter` and Open in New Window is `Ctrl+Enter`, in both Find Project and the sidebar; one remap changes both.

## 0.1.0

- Root folder picker on first run.
- Sidebar tree of categories and projects, with stack icons and labels.
- Open in this window or a new window; Recent group; Find Project picker.
