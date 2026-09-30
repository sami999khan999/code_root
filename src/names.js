// Checks a name typed into New Folder before anything is created. No vscode
// import, so the tests run under plain node.

const fs = require('fs');
const path = require('path');

/** The typed name split into folder names: "api/src" makes two nested folders. */
function nameParts(value) {
  return value.trim().split(/[\\/]+/).filter(Boolean);
}

/**
 * Why `value` can't be created inside `parent`, or undefined when it can.
 * The rules are the strictest of Linux, macOS and Windows, because the same
 * code folder is often opened from more than one of them.
 */
function folderNameProblem(value, parent) {
  const parts = nameParts(value);
  if (!parts.length) return 'Type a name for the folder.';
  for (const part of parts) {
    if (part === '.' || part === '..') return 'Use a real folder name, not . or ..';
    if (/[<>:"|?*\u0000-\u001f]/.test(part)) return 'A folder name can’t contain < > : " | ? * or control characters.';
    if (/[. ]$/.test(part)) return 'A folder name can’t end with a dot or a space.';
  }
  if (fs.existsSync(path.join(parent, ...parts))) return `${parts.join('/')} already exists here.`;
  return undefined;
}

/**
 * Why a folder called `oldName` inside `parent` can't be renamed to `value`,
 * or undefined when it can. A case-only change ("Api" → "api") is allowed even
 * where the file system says the new name already exists.
 */
function renameProblem(value, parent, oldName) {
  const name = value.trim();
  if (/[\\/]/.test(name)) return 'A new name can’t contain / or \\ (this renames, it doesn’t move).';
  const problem = folderNameProblem(name, parent);
  if (problem && problem.endsWith('already exists here.') && name.toLowerCase() === oldName.toLowerCase()) {
    return undefined;
  }
  return problem;
}

module.exports = { nameParts, folderNameProblem, renameProblem };
