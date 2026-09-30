// Code Root: pick the folder all your code lives in, then browse and open its
// projects from the sidebar, in this window or a new one.

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const scanner = require('./scanner');
const { getConfig, scanOptions } = require('./config');
const { ProjectTree, tildify } = require('./tree');
const { Recent } = require('./recent');
const { nameParts, folderNameProblem, renameProblem } = require('./names');
const { splitName } = require('./stacks');

const VIEW_ID = 'codeRoot.tree';
const WELCOMED_KEY = 'codeRoot.welcomed';

/** Path from whatever a command was called with: a tree node, a Uri, or nothing. */
function pathOf(arg) {
  if (!arg) return undefined;
  if (arg.entry) return arg.entry.path;
  if (arg.type === 'group' && arg.id === 'root') return getConfig().root;
  if (arg.fsPath) return arg.fsPath;
  return undefined;
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Same shape as the tree items' contextValue, for keybinding `when` clauses. */
function selectionKind(node) {
  if (!node) return '';
  if (node.type === 'group') return `${node.id}Group`;
  return `${node.entry.kind}${node.openedAt ? '.recent' : ''}`;
}

/** "noRoot" | "missing" | "ready" — drives the welcome screens in package.json. */
function rootState() {
  const { root } = getConfig();
  if (!root) return 'noRoot';
  try {
    return fs.statSync(root).isDirectory() ? 'ready' : 'missing';
  } catch {
    return 'missing';
  }
}

function activate(context) {
  const recent = new Recent(context.globalState);
  const tree = new ProjectTree(recent);
  const view = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: tree, showCollapseAll: true });
  context.subscriptions.push(view);

  // Keybindings call commands with no argument, so fall back to the tree selection.
  const target = (arg) => arg || view.selection[0];
  const setSelection = () =>
    vscode.commands.executeCommand('setContext', 'codeRoot.selection', selectionKind(view.selection[0]));
  context.subscriptions.push(view.onDidChangeSelection(setSelection));

  const update = () => {
    vscode.commands.executeCommand('setContext', 'codeRoot.state', rootState());
    tree.refresh();
  };

  async function openFolder(folder, newWindow) {
    if (!folder) return;
    if (!newWindow && (vscode.workspace.workspaceFolders || []).some((f) => f.uri.fsPath === folder)) {
      vscode.window.showInformationMessage(`${path.basename(folder)} is already open in this window.`);
      return;
    }
    await recent.add(folder);
    tree.refresh();
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folder), {
      forceNewWindow: newWindow,
    });
  }

  async function selectRoot() {
    const { root } = getConfig();
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Use as Code Root',
      title: 'Choose the folder where all your code lives',
      defaultUri: vscode.Uri.file(root && rootState() === 'ready' ? root : os.homedir()),
    });
    if (!picked || !picked.length) return;
    await vscode.workspace
      .getConfiguration('codeRoot')
      .update('rootFolder', tildify(picked[0].fsPath), vscode.ConfigurationTarget.Global);
    vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }

  let activePick;

  async function findProject() {
    const { root, searchDepth } = getConfig();
    if (rootState() !== 'ready') return selectRoot();

    const mod = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
    const hereButton = { iconPath: new vscode.ThemeIcon('arrow-right'), tooltip: 'Open Here (Enter)' };
    const newWindowButton = {
      iconPath: new vscode.ThemeIcon('empty-window'),
      tooltip: `Open in New Window (${mod}+Enter)`,
    };
    const pick = vscode.window.createQuickPick();
    pick.placeholder = `Find a project — Enter opens here, ${mod}+Enter opens a new window`;
    pick.matchOnDescription = true;
    pick.matchOnDetail = true;
    pick.busy = true;
    activePick = pick;
    vscode.commands.executeCommand('setContext', 'codeRoot.finding', true);
    pick.show();

    const toItem = (e) => ({
      label: `$(${e.icon}) ${e.name}`,
      description: e.stackLabel,
      detail: tildify(path.dirname(e.path)),
      path: e.path,
      buttons: [hereButton, newWindowButton],
    });

    const [projects, recentEntries] = await Promise.all([
      scanner.findProjects(root, scanOptions(), searchDepth),
      Promise.all(recent.list().slice(0, 5).map((r) => scanner.describe(r.path, scanOptions()))),
    ]);
    const recentItems = recentEntries.filter((e) => e && e.kind === 'project').map(toItem);
    const recentPaths = new Set(recentItems.map((i) => i.path));
    pick.items = [
      ...(recentItems.length ? [{ label: 'recent', kind: vscode.QuickPickItemKind.Separator }, ...recentItems] : []),
      { label: tildify(root), kind: vscode.QuickPickItemKind.Separator },
      ...projects.filter((e) => !recentPaths.has(e.path)).map(toItem),
    ];
    pick.busy = false;

    pick.onDidAccept(() => {
      const [item] = pick.selectedItems;
      pick.hide();
      if (item) openFolder(item.path, false);
    });
    pick.onDidTriggerItemButton((e) => {
      pick.hide();
      openFolder(e.item.path, e.button === newWindowButton);
    });
    pick.onDidHide(() => {
      if (activePick === pick) {
        activePick = undefined;
        vscode.commands.executeCommand('setContext', 'codeRoot.finding', false);
      }
      pick.dispose();
    });
  }

  /**
   * Open/Open in New Window share keys between the tree and Find Project:
   * with no argument, act on the highlighted result if the picker is up,
   * otherwise on the tree selection.
   */
  function openCommand(arg, newWindow) {
    if (!arg && activePick) {
      const pick = activePick;
      const [item] = pick.activeItems;
      if (!item) return;
      pick.hide();
      return openFolder(item.path, newWindow);
    }
    return openFolder(pathOf(target(arg)), newWindow);
  }

  /** Where New Folder creates: inside a folder or the root, next to a project. */
  function newFolderParent(node) {
    const { root } = getConfig();
    if (!node || node.type === 'group') return root;
    return node.entry.kind === 'folder' ? node.entry.path : path.dirname(node.entry.path);
  }

  async function newFolder(arg) {
    if (rootState() !== 'ready') return selectRoot();
    const parent = newFolderParent(target(arg));
    const value = await vscode.window.showInputBox({
      title: 'New Folder',
      prompt: `In ${tildify(parent)}  ·  a/b makes nested folders`,
      placeHolder: 'my_app-nextjs',
      validateInput: (v) => (v.trim() ? folderNameProblem(v, parent) : undefined),
    });
    if (value === undefined) return;
    const problem = folderNameProblem(value, parent);
    if (problem) {
      vscode.window.showErrorMessage(problem);
      return;
    }

    const folder = path.join(parent, ...nameParts(value));
    try {
      await fs.promises.mkdir(folder, { recursive: true });
    } catch (err) {
      vscode.window.showErrorMessage(`Couldn't create ${tildify(folder)}: ${err.message}`);
      return;
    }
    tree.refresh();

    const entry = await scanner.describe(folder, scanOptions());
    if (entry) {
      try {
        await view.reveal({ type: 'entry', entry }, { select: true, focus: true, expand: false });
      } catch {
        // Not in the tree (a hidden or excluded name): the message below still says where it is.
      }
    }
    const choice = await vscode.window.showInformationMessage(
      `Created ${tildify(folder)}`,
      'Open Here',
      'Open in New Window',
    );
    if (choice) openFolder(folder, choice === 'Open in New Window');
  }

  async function renameFolder(arg) {
    const node = target(arg);
    if (!node || node.type !== 'entry') return;
    const oldPath = node.entry.path;
    const parent = path.dirname(oldPath);
    const oldName = path.basename(oldPath);

    const value = await vscode.window.showInputBox({
      title: 'Rename',
      prompt: `Rename ${tildify(oldPath)}`,
      value: oldName,
      // Select the name but not a stack suffix: "shop" in "shop-nextjs".
      valueSelection: [0, splitName(oldName).name.length],
      validateInput: (v) => renameProblem(v, parent, oldName),
    });
    if (value === undefined || value.trim() === oldName) return;
    const newName = value.trim();
    const problem = renameProblem(newName, parent, oldName);
    if (problem) {
      vscode.window.showErrorMessage(problem);
      return;
    }
    const newPath = path.join(parent, newName);

    // Renaming the folder this window has open would leave the window pointing
    // at a path that no longer exists, so reopen it at the new one.
    const openHere = (vscode.workspace.workspaceFolders || []).find((f) => isInside(f.uri.fsPath, oldPath));
    if (openHere) {
      const ok = await vscode.window.showWarningMessage(
        `${oldName} is open in this window. Renaming it reopens the window at the new name.`,
        { modal: true },
        'Rename and Reopen',
      );
      if (!ok) return;
    }

    try {
      await fs.promises.rename(oldPath, newPath);
    } catch (err) {
      vscode.window.showErrorMessage(`Couldn't rename ${tildify(oldPath)}: ${err.message}`);
      return;
    }
    await recent.rename(oldPath, newPath);
    tree.refresh();

    if (openHere) {
      const reopened = newPath + openHere.uri.fsPath.slice(oldPath.length);
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(reopened), { forceNewWindow: false });
      return;
    }
    const entry = await scanner.describe(newPath, scanOptions());
    if (entry) {
      try {
        await view.reveal({ type: 'entry', entry }, { select: true, focus: true, expand: false });
      } catch {
        // Not shown in the tree (hidden or excluded name).
      }
    }
    vscode.window.setStatusBarMessage(`$(check) Renamed to ${newName}`, 3000);
  }

  const commands = {
    'codeRoot.selectRoot': selectRoot,
    'codeRoot.refresh': update,
    'codeRoot.newFolder': newFolder,
    'codeRoot.rename': renameFolder,
    'codeRoot.find': findProject,
    'codeRoot.open': (arg) => openCommand(arg, false),
    'codeRoot.openNewWindow': (arg) => openCommand(arg, true),
    'codeRoot.revealInOS': (arg) => {
      const p = pathOf(target(arg));
      if (p) vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(p));
    },
    'codeRoot.copyPath': async (arg) => {
      const p = pathOf(target(arg));
      if (!p) return;
      await vscode.env.clipboard.writeText(p);
      vscode.window.setStatusBarMessage(`$(check) Copied ${tildify(p)}`, 2000);
    },
    'codeRoot.removeFromRecent': async (arg) => {
      const node = target(arg);
      if (!node || !node.openedAt) return;
      await recent.remove(pathOf(node));
      tree.refresh();
    },
    'codeRoot.clearRecent': async () => {
      await recent.clear();
      tree.refresh();
    },
    'codeRoot.keyboardShortcuts': () =>
      vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', 'codeRoot.'),
  };
  for (const [id, fn] of Object.entries(commands)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codeRoot')) update();
    }),
    // Folders get created and deleted outside VS Code; re-read when coming back.
    vscode.window.onDidChangeWindowState((s) => {
      if (s.focused && view.visible) tree.refresh();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => tree.refresh()),
  );

  update();

  // Opening a project any other way (terminal, File > Open) still counts as recent.
  const { root } = getConfig();
  const [current] = vscode.workspace.workspaceFolders || [];
  if (root && current && current.uri.scheme === 'file' && isInside(current.uri.fsPath, root) && current.uri.fsPath !== root) {
    recent.add(current.uri.fsPath).then(() => tree.refresh());
  }

  // First run: bring the view forward so the "Select Root Folder" button is seen.
  if (rootState() === 'noRoot' && !context.globalState.get(WELCOMED_KEY)) {
    context.globalState.update(WELCOMED_KEY, true);
    vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
