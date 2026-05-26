import { getDb, searchDecisions, searchChats, closeDb } from '../db.js';

/**
 * Executes a full-text search across decisions and chats.
 * @param {string} query - The search string
 * @param {object} [options]
 * @param {string} [options.cwd]
 */
export function searchCommand(query, options = {}) {
  const cwd = options.cwd || process.cwd();

  if (!query || query.trim() === '') {
    console.error('\x1b[31m%s\x1b[0m', 'Error: Please specify a search query (e.g. nma search "ssr hydration").');
    process.exit(1);
  }

  const db = getDb(cwd);

  try {
    const matchedDecisions = searchDecisions(db, query);
    const matchedChats = searchChats(db, query);
    closeDb();

    console.log('\x1b[36m%s\x1b[0m', `Searching NeuroMemory-AI for: "${query}"\n`);

    let foundAny = false;

    // Display Matched Decisions
    if (matchedDecisions.length > 0) {
      foundAny = true;
      console.log('\x1b[35m%s\x1b[0m', '=== MATCHED ARCHITECTURAL DECISIONS ===');
      for (const d of matchedDecisions) {
        const dateStr = new Date(d.timestamp).toISOString().split('T')[0];
        console.log(`\n\x1b[32m✔ ${d.decision}\x1b[0m`);
        console.log(`  \x1b[90mDate:\x1b[0m ${dateStr}`);
        if (d.reason) {
          console.log(`  \x1b[90mContext/Reason:\x1b[0m ${d.reason}`);
        }
      }
      console.log();
    }

    // Display Matched Chats
    if (matchedChats.length > 0) {
      foundAny = true;
      console.log('\x1b[34m%s\x1b[0m', '=== MATCHED CONVERSATIONS / ISSUES ===');
      for (const c of matchedChats) {
        const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
        console.log(`\n\x1b[33m● [${c.title}]\x1b[0m \x1b[90m(${dateStr})\x1b[0m`);
        if (c.tags) {
          console.log(`  \x1b[90mTags:\x1b[0m ${c.tags}`);
        }
        const promptLines = c.prompt.split('\n');
        const promptPreview = promptLines[0] + (promptLines.length > 1 ? ' ...' : '');
        console.log(`  \x1b[90mPrompt Preview:\x1b[0m ${promptPreview}`);
      }
      console.log();
    }

    if (!foundAny) {
      console.log('\x1b[33m%s\x1b[0m', 'No records found matching your query.');
    }
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Error executing search:', err.message);
    try { closeDb(); } catch (_) {}
    process.exit(1);
  }
}
