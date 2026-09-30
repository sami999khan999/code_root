// Reads the codeRoot.* settings in one place.

const vscode = require('vscode');
const os = require('os');
const path = require('path');

function expandHome(p) {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function getConfig() {
  const c = vscode.workspace.getConfiguration('codeRoot');
  const raw = (c.get('rootFolder') || '').trim();
  return {
    root: raw ? path.resolve(expandHome(raw)) : '',
    exclude: new Set(c.get('exclude') || []),
    showHidden: !!c.get('showHidden'),
    recentCount: Math.max(0, c.get('recentCount') ?? 5),
    searchDepth: Math.max(1, c.get('searchDepth') ?? 5),
  };
}

function scanOptions() {
  const { exclude, showHidden } = getConfig();
  return { exclude, showHidden };
}

module.exports = { getConfig, scanOptions };
