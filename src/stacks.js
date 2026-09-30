// Works out what a project is built with, for its icon and the short label next
// to its name. Two sources: the folder name ("shop-nextjs-nestjs" → Next.js ·
// NestJS) and the files inside (package.json deps, manage.py, Cargo.toml, …).
// No vscode import, so the tests run under plain node.

const STACKS = {
  nextjs: { label: 'Next.js', icon: 'globe', color: 'charts.foreground' },
  react: { label: 'React', icon: 'symbol-event', color: 'charts.blue' },
  tanstackstart: { label: 'TanStack Start', icon: 'layers', color: 'charts.orange' },
  vite: { label: 'Vite', icon: 'zap', color: 'charts.purple' },
  vue: { label: 'Vue', icon: 'triangle-down', color: 'charts.green' },
  svelte: { label: 'Svelte', icon: 'flame', color: 'charts.orange' },
  expo: { label: 'Expo', icon: 'device-mobile', color: 'charts.purple' },
  flutter: { label: 'Flutter', icon: 'device-mobile', color: 'charts.blue' },
  electron: { label: 'Electron', icon: 'window', color: 'charts.blue' },
  nestjs: { label: 'NestJS', icon: 'server', color: 'charts.red' },
  express: { label: 'Express', icon: 'server', color: 'charts.green' },
  node: { label: 'Node.js', icon: 'server', color: 'charts.green' },
  jsonserver: { label: 'JSON Server', icon: 'database', color: 'charts.green' },
  django: { label: 'Django', icon: 'server-process', color: 'charts.green' },
  flask: { label: 'Flask', icon: 'server-process', color: 'charts.foreground' },
  fastapi: { label: 'FastAPI', icon: 'server-process', color: 'charts.green' },
  python: { label: 'Python', icon: 'symbol-namespace', color: 'charts.yellow' },
  laravel: { label: 'Laravel', icon: 'flame', color: 'charts.red' },
  php: { label: 'PHP', icon: 'symbol-variable', color: 'charts.purple' },
  rust: { label: 'Rust', icon: 'gear', color: 'charts.orange' },
  go: { label: 'Go', icon: 'symbol-interface', color: 'charts.blue' },
  java: { label: 'Java', icon: 'coffee', color: 'charts.orange' },
  c: { label: 'C', icon: 'symbol-structure', color: 'charts.blue' },
  cpp: { label: 'C++', icon: 'symbol-structure', color: 'charts.blue' },
  html: { label: 'HTML', icon: 'code', color: 'charts.orange' },
  css: { label: 'CSS', icon: 'symbol-color', color: 'charts.blue' },
  js: { label: 'JS', icon: 'symbol-method', color: 'charts.yellow' },
  ts: { label: 'TS', icon: 'symbol-method', color: 'charts.blue' },
  'chrome-ext': { label: 'Chrome Ext', icon: 'browser', color: 'charts.yellow' },
  'vscode-ext': { label: 'VS Code Ext', icon: 'extensions', color: 'charts.blue' },
  ext: { label: 'Extension', icon: 'extensions', color: 'charts.blue' },
  npm: { label: 'npm', icon: 'package', color: 'charts.red' },
  n8n: { label: 'n8n', icon: 'type-hierarchy', color: 'charts.orange' },
  fullstack: { label: 'Full-stack', icon: 'layers', color: 'charts.purple' },
  notes: { label: 'Notes', icon: 'notebook', color: 'charts.purple' },
};

const PLAIN_PROJECT = { label: '', icon: 'repo', color: undefined };

// Spellings in folder names that mean the same stack.
const ALIASES = { next: 'nextjs', tanstack: 'tanstackstart', nest: 'nestjs', nodejs: 'node', 'c++': 'cpp' };

/**
 * Split "my_app-django-nextjs" into its name and stack tokens. Only splits when
 * every part after the first dash is a known stack, so "audio_cursor-browser-extention"
 * keeps its full name.
 */
function splitName(folderName) {
  const parts = folderName.split('-');
  if (parts.length < 2 || !parts[0]) return { name: folderName, tokens: [] };

  const tokens = [];
  const rest = parts.slice(1).map((p) => p.toLowerCase());
  for (let i = 0; i < rest.length; i++) {
    const pair = `${rest[i]}-${rest[i + 1]}`;
    if (STACKS[pair]) {
      tokens.push(pair);
      i++;
      continue;
    }
    const token = ALIASES[rest[i]] || rest[i];
    if (!STACKS[token]) return { name: folderName, tokens: [] };
    tokens.push(token);
  }
  return { name: parts[0], tokens };
}

/** Best guess from the files in the folder, or undefined. */
function detectFromContents(names, files, pkg, manifest) {
  if (pkg && pkg.engines && pkg.engines.vscode) return 'vscode-ext';
  if (manifest && manifest.manifest_version) return 'chrome-ext';
  if (names.has('pubspec.yaml')) return 'flutter';

  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const has = (d) => Object.prototype.hasOwnProperty.call(deps, d);
    if (has('expo') || has('react-native')) return 'expo';
    if (has('electron')) return 'electron';
    if (has('@tanstack/react-start') || has('@tanstack/start')) return 'tanstackstart';
    if (has('next')) return 'nextjs';
    if (has('@nestjs/core')) return 'nestjs';
    if (has('nuxt') || has('vue')) return 'vue';
    if (has('svelte') || has('@sveltejs/kit')) return 'svelte';
    if (has('express')) return 'express';
    if (has('json-server')) return 'jsonserver';
    if (has('react')) return 'react';
    if (has('vite')) return 'vite';
    if (has('n8n-workflow') || has('n8n')) return 'n8n';
  }

  if (names.has('manage.py')) return 'django';
  if (names.has('artisan')) return 'laravel';
  if (names.has('composer.json')) return 'php';
  if (names.has('Cargo.toml')) return 'rust';
  if (names.has('go.mod')) return 'go';
  if (names.has('pom.xml') || names.has('build.gradle') || names.has('build.gradle.kts')) return 'java';
  if (['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'].some((n) => names.has(n))) return 'python';
  if (pkg) return 'node';

  const ext = (n) => (n.includes('.') ? n.slice(n.lastIndexOf('.') + 1).toLowerCase() : '');
  const exts = new Set(files.map(ext));
  if (exts.has('py')) return 'python';
  if (exts.has('java')) return 'java';
  if (exts.has('cpp') || exts.has('cc') || exts.has('hpp')) return 'cpp';
  if (exts.has('c')) return 'c';
  if (exts.has('html')) return 'html';
  const visibleFiles = files.filter((n) => !n.startsWith('.'));
  if (exts.has('md') && visibleFiles.every((n) => ['md', 'mdx', 'txt'].includes(ext(n)))) return 'notes';
  return undefined;
}

/**
 * `names` is everything in the folder, `files` only its regular files.
 * @returns {{ name: string, tokens: string[], label: string, icon: string, color?: string }}
 *   `name` is the folder name without its stack suffix; `label` is e.g. "Django · Next.js".
 */
function describeStack(folderName, names, files, pkg, manifest, isSplitApp) {
  const { name, tokens } = splitName(folderName);
  // The name is chosen on purpose, so it beats a guess from the files.
  const detected = tokens.length
    ? tokens[0]
    : detectFromContents(names, files, pkg, manifest) || (isSplitApp ? 'fullstack' : undefined);
  const primary = STACKS[detected] || PLAIN_PROJECT;
  const label = tokens.length ? tokens.map((t) => STACKS[t].label).join(' · ') : primary.label;
  return { name, tokens, label, icon: primary.icon, color: primary.color };
}

module.exports = { STACKS, splitName, detectFromContents, describeStack };
