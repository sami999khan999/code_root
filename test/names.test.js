// What New Folder accepts, before anything is created.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { nameParts, folderNameProblem } = require('../src/names');

const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'code-root-names-'));
fs.mkdirSync(path.join(parent, 'taken'));

test('plain and nested names are accepted', () => {
  assert.strictEqual(folderNameProblem('shop-nextjs', parent), undefined);
  assert.strictEqual(folderNameProblem('  api/src  ', parent), undefined);
  assert.deepStrictEqual(nameParts('api//src/'), ['api', 'src']);
  assert.deepStrictEqual(nameParts('api\\src'), ['api', 'src']);
});

test('empty, dot and reserved names are refused', () => {
  assert.match(folderNameProblem('   ', parent), /Type a name/);
  assert.match(folderNameProblem('..', parent), /not \. or \.\./);
  assert.match(folderNameProblem('a/../b', parent), /not \. or \.\./);
  assert.match(folderNameProblem('what?', parent), /can’t contain/);
  assert.match(folderNameProblem('notes.', parent), /end with a dot/);
});

test('an existing folder is refused, a new one inside it is fine', () => {
  assert.match(folderNameProblem('taken', parent), /already exists/);
  assert.strictEqual(folderNameProblem('taken/new', parent), undefined);
});

const { renameProblem } = require('../src/names');

test('rename: a free name is fine, slashes and taken names are not', () => {
  fs.mkdirSync(path.join(parent, 'Api'));
  assert.strictEqual(renameProblem('api_v2', parent, 'Api'), undefined);
  assert.match(renameProblem('a/b', parent, 'Api'), /renames, it doesn’t move/);
  assert.match(renameProblem('taken', parent, 'Api'), /already exists/);
});

test('rename: changing only the case is allowed', () => {
  assert.strictEqual(renameProblem('API', parent, 'Api'), undefined);
});
