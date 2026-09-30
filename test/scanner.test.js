// Builds a small fake code folder and checks what counts as a project.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const scanner = require('../src/scanner');

const opts = { exclude: new Set(['node_modules']), showHidden: false };

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-root-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    if (rel.endsWith('/')) {
      fs.mkdirSync(full, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

const root = makeTree({
  'projects/ongoing/shop-nextjs/package.json': JSON.stringify({ dependencies: { next: '15' } }),
  'projects/ongoing/api/package.json': JSON.stringify({ dependencies: { '@nestjs/core': '10' } }),
  'projects/ongoing/crm-django-nextjs/frontend/': '',
  'projects/ongoing/split_app/frontend/package.json': '{}',
  'projects/ongoing/split_app/backend/manage.py': '',
  'projects/completed/game-python/main.py': 'print(1)',
  'drafts/scratch/notes.md': '# hi',
  'drafts/empty_category/': '',
  'drafts/.hidden/x.txt': '',
  'drafts/node_modules/x/index.js': '',
});

test('categories are folders, anything with files or markers is a project', async () => {
  const top = await scanner.list(root, opts);
  assert.deepStrictEqual(
    top.map((e) => [e.folderName, e.kind]),
    [
      ['drafts', 'folder'],
      ['projects', 'folder'],
    ],
  );
  const drafts = await scanner.list(path.join(root, 'drafts'), opts);
  assert.deepStrictEqual(
    drafts.map((e) => [e.folderName, e.kind]),
    [
      ['empty_category', 'folder'],
      ['scratch', 'project'],
    ],
  );
});

test('stack comes from the folder name first, then from the files', async () => {
  const ongoing = await scanner.list(path.join(root, 'projects/ongoing'), opts);
  const byName = Object.fromEntries(ongoing.map((e) => [e.folderName, e]));
  assert.strictEqual(byName['shop-nextjs'].name, 'shop');
  assert.strictEqual(byName['shop-nextjs'].stackLabel, 'Next.js');
  assert.strictEqual(byName.api.stackLabel, 'NestJS');
  assert.strictEqual(byName['crm-django-nextjs'].kind, 'project');
  assert.strictEqual(byName['crm-django-nextjs'].stackLabel, 'Django · Next.js');
  assert.strictEqual(byName.split_app.kind, 'project');
  assert.strictEqual(byName.split_app.stackLabel, 'Full-stack');
});

test('findProjects walks categories but not into projects', async () => {
  const found = await scanner.findProjects(root, opts, 5);
  assert.deepStrictEqual(found.map((e) => e.folderName).sort(), [
    'api',
    'crm-django-nextjs',
    'game-python',
    'scratch',
    'shop-nextjs',
    'split_app',
  ]);
});

test('unreadable or missing folders are skipped, not thrown', async () => {
  assert.deepStrictEqual(await scanner.list(path.join(root, 'nope'), opts), []);
  assert.strictEqual(await scanner.describe(path.join(root, 'nope'), opts), null);
});
