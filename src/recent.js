// Recently opened projects, newest first. Kept in globalState, which is per
// machine: Settings Sync doesn't carry it, so Linux and Windows paths never mix.

const KEY = 'codeRoot.recent';
const KEEP = 30;

class Recent {
  /** @param {import('vscode').Memento} state */
  constructor(state) {
    this.state = state;
  }

  /** @returns {{ path: string, time: number }[]} */
  list() {
    return this.state.get(KEY, []);
  }

  add(folder) {
    const rest = this.list().filter((r) => r.path !== folder);
    return this.state.update(KEY, [{ path: folder, time: Date.now() }, ...rest].slice(0, KEEP));
  }

  remove(folder) {
    return this.state.update(
      KEY,
      this.list().filter((r) => r.path !== folder),
    );
  }

  clear() {
    return this.state.update(KEY, []);
  }
}

module.exports = { Recent };
