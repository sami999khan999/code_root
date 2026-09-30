// Reads the root folder one level at a time and sorts each subfolder into a
// "project" (something you open) or a "folder" (a category that only groups
// other folders, like projects/ongoing). Only expanded folders are read, so a
// big root stays cheap. No vscode import, so the tests run under plain node.

const fs = require('fs/promises');
const path = require('path');
const { describeStack, splitName } = require('./stacks');

// Any of these in a folder makes it a project.
const PROJECT_MARKERS = new Set([
  '.git', 'package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile',
  'manage.py', 'Cargo.toml', 'go.mod', 'composer.json', 'artisan', 'pubspec.yaml',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'CMakeLists.txt', 'Makefile',
  'manifest.json', 'index.html', 'deno.json', '.vscode',
]);

// Files that don't count as "this folder has its own files".
const JUNK_FILES = new Set(['.DS_Store', 'desktop.ini', 'Thumbs.db', '.directory', '.localized']);

// A folder holding only parts like these is one app split in two, not a category.
const PART_NAMES = new Set([
  'frontend', 'backend', 'client', 'server', 'api', 'web', 'app', 'apps', 'mobile',
  'packages', 'admin', 'dashboard', 'www', 'site', 'shared', 'common',
]);

async function readEntries(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return undefined;
  }
}

async function readGitBranch(dir) {
  try {
    const head = (await fs.readFile(path.join(dir, '.git', 'HEAD'), 'utf8')).trim();
    return head.startsWith('ref: refs/heads/') ? head.slice(16) : head.slice(0, 7);
  } catch {
    return undefined;
  }
}

async function isDir(dir, ent) {
  if (ent.isDirectory()) return true;
  if (!ent.isSymbolicLink()) return false;
  try {
    return (await fs.stat(path.join(dir, ent.name))).isDirectory();
  } catch {
    return false;
  }
}

function visible(name, opts) {
  return (opts.showHidden || !name.startsWith('.')) && !opts.exclude.has(name);
}

/**
 * Look inside one folder and decide what it is.
 * @returns {Promise<Entry|null>} null when the folder can't be read.
 *
 * @typedef {object} Entry
 * @property {'project'|'folder'} kind
 * @property {string} path
 * @property {string} folderName  real name on disk
 * @property {string} name        display name (stack suffix removed for projects)
 * @property {string} stackLabel  e.g. "Django · Next.js" (projects only)
 * @property {string} icon        codicon id (projects only)
 * @property {string} [color]     theme color id (projects only)
 * @property {string} [branch]    git branch, when it's a repo
 * @property {number} childCount  visible subfolders
 * @property {number} mtime       ms since epoch
 */
async function describe(dirPath, opts) {
  const entries = await readEntries(dirPath);
  if (!entries) return null;

  const folderName = path.basename(dirPath);
  const names = new Set(entries.map((e) => e.name));
  const files = entries.filter((e) => e.isFile() && !JUNK_FILES.has(e.name)).map((e) => e.name);
  const hasFiles = files.length > 0;
  const subdirs = [];
  for (const ent of entries) {
    if (visible(ent.name, opts) && (await isDir(dirPath, ent))) subdirs.push(ent.name);
  }
  const hasMarker = [...names].some((n) => PROJECT_MARKERS.has(n));
  const isSplitApp = subdirs.length > 0 && subdirs.every((d) => PART_NAMES.has(d.toLowerCase()));
  const namedLikeProject = splitName(folderName).tokens.length > 0;

  let mtime = 0;
  try {
    mtime = (await fs.stat(dirPath)).mtimeMs;
  } catch {
    // keep 0
  }

  const base = { path: dirPath, folderName, childCount: subdirs.length, mtime };

  if (!(hasMarker || hasFiles || isSplitApp || namedLikeProject)) {
    return { ...base, kind: 'folder', name: folderName, stackLabel: '', icon: 'folder' };
  }

  const [pkg, manifest, branch] = await Promise.all([
    names.has('package.json') ? readJson(path.join(dirPath, 'package.json')) : undefined,
    names.has('manifest.json') ? readJson(path.join(dirPath, 'manifest.json')) : undefined,
    names.has('.git') ? readGitBranch(dirPath) : undefined,
  ]);
  const stack = describeStack(folderName, names, files, pkg, manifest, isSplitApp);
  return {
    ...base,
    kind: 'project',
    name: stack.name,
    stackLabel: stack.label,
    icon: stack.icon,
    color: stack.color,
    branch,
  };
}

function compareEntries(a, b) {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
  return a.folderName.localeCompare(b.folderName, undefined, { numeric: true, sensitivity: 'base' });
}

/** Subfolders of `dir`, described and sorted (categories first, then projects). */
async function list(dir, opts) {
  const entries = await readEntries(dir);
  if (!entries) return [];
  const dirs = [];
  for (const ent of entries) {
    if (visible(ent.name, opts) && (await isDir(dir, ent))) dirs.push(path.join(dir, ent.name));
  }
  const described = await Promise.all(dirs.map((d) => describe(d, opts)));
  return described.filter(Boolean).sort(compareEntries);
}

/**
 * Every project under `root`, for the search picker. Stops at projects (their
 * insides aren't listed) and at `maxDepth`.
 */
async function findProjects(root, opts, maxDepth) {
  const found = [];
  let level = [root];
  for (let depth = 0; depth < maxDepth && level.length; depth++) {
    const lists = await Promise.all(level.map((d) => list(d, opts)));
    level = [];
    for (const entry of lists.flat()) {
      if (entry.kind === 'project') found.push(entry);
      else level.push(entry.path);
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

module.exports = { describe, list, findProjects };
