// The sidebar tree: a "Recent" group on top, then the root folder with its
// categories and projects. Categories expand; projects open when clicked.

const vscode = require('vscode');
const path = require('path');
const os = require('os');
const scanner = require('./scanner');
const { getConfig, scanOptions } = require('./config');

function tildify(p) {
  const home = os.homedir();
  return p === home || p.startsWith(home + path.sep) ? '~' + p.slice(home.length) : p;
}

function timeAgo(ms) {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function currentFolders() {
  return (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
}

function tooltipFor(entry, openedAt) {
  const md = new vscode.MarkdownString(undefined, true);
  md.appendMarkdown(`**$(${entry.kind === 'project' ? entry.icon : 'folder'}) ${entry.folderName}**\n\n`);
  if (entry.stackLabel) md.appendMarkdown(`${entry.stackLabel}\n\n`);
  md.appendMarkdown(`\`${tildify(entry.path)}\`\n\n`);
  const facts = [];
  if (entry.branch) facts.push(`$(git-branch) ${entry.branch}`);
  if (entry.kind === 'folder') facts.push(`$(folder) ${entry.childCount} inside`);
  if (openedAt) facts.push(`$(history) opened ${timeAgo(openedAt)}`);
  else if (entry.mtime) facts.push(`$(clock) changed ${timeAgo(entry.mtime)}`);
  if (facts.length) md.appendMarkdown(facts.join('  ·  '));
  return md;
}

/**
 * Tree nodes are plain objects:
 *   { type: 'group', id: 'recent' | 'root' }
 *   { type: 'entry', entry: Entry, openedAt?: number }
 */
class ProjectTree {
  /** @param {import('./recent').Recent} recent */
  constructor(recent) {
    this.recent = recent;
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChange.event;
  }

  refresh() {
    this._onDidChange.fire(undefined);
  }

  /** @returns {vscode.TreeItem} */
  getTreeItem(node) {
    if (node.type === 'group') return this._groupItem(node);
    return this._entryItem(node);
  }

  async getChildren(node) {
    const root = getConfig().root;
    if (!root) return [];

    if (!node) {
      const groups = [];
      if (getConfig().recentCount > 0 && (await this._recentNodes()).length) {
        groups.push({ type: 'group', id: 'recent' });
      }
      groups.push({ type: 'group', id: 'root' });
      return groups;
    }

    if (node.type === 'group' && node.id === 'recent') return this._recentNodes();
    const dir = node.type === 'group' ? root : node.entry.path;
    const entries = await scanner.list(dir, scanOptions());
    return entries.map((entry) => ({ type: 'entry', entry }));
  }

  async _recentNodes() {
    const items = this.recent.list().slice(0, getConfig().recentCount);
    const described = await Promise.all(
      items.map(async (r) => {
        const entry = await scanner.describe(r.path, scanOptions());
        return entry && { type: 'entry', entry, openedAt: r.time };
      }),
    );
    return described.filter(Boolean);
  }

  _groupItem(node) {
    const { root } = getConfig();
    if (node.id === 'recent') {
      const item = new vscode.TreeItem('Recent', vscode.TreeItemCollapsibleState.Expanded);
      item.id = 'group:recent';
      item.iconPath = new vscode.ThemeIcon('history');
      item.contextValue = 'recentGroup';
      return item;
    }
    const item = new vscode.TreeItem(path.basename(root) || root, vscode.TreeItemCollapsibleState.Expanded);
    item.id = 'group:root';
    item.iconPath = new vscode.ThemeIcon('root-folder', new vscode.ThemeColor('charts.blue'));
    item.description = tildify(root);
    item.tooltip = `All folders under ${tildify(root)}`;
    item.contextValue = 'rootGroup';
    item.resourceUri = vscode.Uri.file(root);
    return item;
  }

  _entryItem(node) {
    const { entry, openedAt } = node;
    const isProject = entry.kind === 'project';
    const isCurrent = currentFolders().includes(entry.path);

    const item = new vscode.TreeItem(
      isCurrent ? { label: entry.name, highlights: [[0, entry.name.length]] } : entry.name,
      isProject ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
    );
    item.id = `${openedAt ? 'recent' : 'tree'}:${entry.path}`;
    item.tooltip = tooltipFor(entry, openedAt);
    item.contextValue = `${entry.kind}${openedAt ? '.recent' : ''}`;

    const parts = [];
    if (isCurrent) parts.push('● open');
    if (isProject) {
      item.iconPath = new vscode.ThemeIcon(entry.icon, entry.color ? new vscode.ThemeColor(entry.color) : undefined);
      if (entry.stackLabel) parts.push(entry.stackLabel);
      if (openedAt) parts.push(timeAgo(openedAt));
      item.command = { command: 'codeRoot.open', title: 'Open', arguments: [node] };
    } else {
      // Folder icon from the active icon theme, so named folders get their themed icons.
      item.iconPath = vscode.ThemeIcon.Folder;
      item.resourceUri = vscode.Uri.file(entry.path);
      parts.push(`${entry.childCount}`);
    }
    item.description = parts.join('  ·  ');
    return item;
  }
}

module.exports = { ProjectTree, tildify, timeAgo };
