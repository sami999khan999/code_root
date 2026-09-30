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

  const commands = {
    'codeRoot.selectRoot': selectRoot,
    'codeRoot.refresh': update,
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
