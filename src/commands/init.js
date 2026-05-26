import path from 'node:path';
import fs from 'node:fs';
import { getDb, closeDb } from '../db.js';
import { createTemplatesIfNotExists, compileRhrFiles, getSafePath } from '../utils.js';

/**
 * Initializes NeuroMemory-AI system in the workspace.
 * @param {object} options
 * @param {string} [options.cwd]
 */
export function initCommand(options = {}) {
  const cwd = options.cwd || process.cwd();
  // Resolve the workspace root, then derive .nma/ via getSafePath to enforce boundary
  const normalizedCwd = path.normalize(path.resolve(cwd));
  const nmaDir = getSafePath(normalizedCwd, '.nma');

  console.log('\x1b[36m%s\x1b[0m', 'Initializing NeuroMemory-AI...');

  try {
    // Check existence using the getSafePath-validated path — safe filesystem access
    const isNew = !fs.existsSync(nmaDir);

    // Initializing DB (this creates .nma folder and tables)
    const db = getDb(cwd);

    // Initializing templates
    createTemplatesIfNotExists(nmaDir);

    // Compiling initially
    compileRhrFiles(db, cwd);

    closeDb();

    console.log('\x1b[32m%s\x1b[0m', '✔ NeuroMemory-AI initialized successfully!');
    if (isNew) {
      console.log(`
Created folder: \x1b[35m.nma/\x1b[0m
  - \x1b[34mnma.db\x1b[0m (SQLite database)
  - \x1b[34mproject-overview.md\x1b[0m (Describe your tech stack here)
  - \x1b[34mrules.md\x1b[0m (AI prompt guidelines)
  - \x1b[34mcurrent-state.md\x1b[0m (Current bugs & sprint status)

Generated workspace rules:
  - \x1b[35m.cursorrules\x1b[0m
  - \x1b[35mclaudecode.md\x1b[0m
  - \x1b[35mnma-context.md\x1b[0m
`);
    } else {
      console.log('\x1b[33m%s\x1b[0m', 'Re-initialized database and compiled latest context files.');
    }
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Error during initialization:', err.message);
    process.exit(1);
  }
}
