import { getDb, closeDb } from '../db.js';
import { compileRhrFiles } from '../utils.js';

/**
 * Recompiles target workspace files (.cursorrules, claudecode.md, nma-context.md).
 * @param {object} [options]
 * @param {string} [options.cwd]
 */
export function compileCommand(options = {}) {
  const cwd = options.cwd || process.cwd();
  console.log('\x1b[36m%s\x1b[0m', 'Compiling NeuroMemory-AI workspace files...');

  try {
    const db = getDb(cwd);
    compileRhrFiles(db, cwd);
    closeDb();

    console.log('\x1b[32m%s\x1b[0m', '✔ Successfully recompiled .cursorrules, claudecode.md, nma-context.md, and .nma/decisions.md!');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Error compiling files:', err.message);
    try { closeDb(); } catch (_) {}
    process.exit(1);
  }
}
