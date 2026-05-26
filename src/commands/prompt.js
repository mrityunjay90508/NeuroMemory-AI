import fs from 'node:fs';
import path from 'node:path';
import { getDb, searchDecisions, searchChats, getActiveDecisions, closeDb } from '../db.js';
import { copyToClipboard, createTemplatesIfNotExists } from '../utils.js';

/**
 * Generates an enhanced context-aware prompt, prints it, and copies it to clipboard.
 * @param {string} query - User query/question
 * @param {object} [options]
 * @param {string} [options.cwd]
 */
export function promptCommand(query, options = {}) {
  const cwd = options.cwd || process.cwd();
  const normalizedCwd = path.normalize(path.resolve(cwd));
  const nmaDir = path.normalize(path.resolve(normalizedCwd, '.nma'));
  if (!nmaDir.startsWith(normalizedCwd)) {
    throw new Error('Invalid workspace path');
  }

  if (!query || query.trim() === '') {
    console.error('\x1b[31m%s\x1b[0m', 'Error: Please specify your query (e.g. nma prompt "analytics SSR mismatch").');
    process.exit(1);
  }

  // Ensure templates exist in case they were deleted
  createTemplatesIfNotExists(nmaDir);

  // Read manual markdown files
  const overviewPath = path.normalize(path.join(nmaDir, 'project-overview.md'));
  const rulesPath = path.normalize(path.join(nmaDir, 'rules.md'));
  const statePath = path.normalize(path.join(nmaDir, 'current-state.md'));

  if (!overviewPath.startsWith(nmaDir) || !rulesPath.startsWith(nmaDir) || !statePath.startsWith(nmaDir)) {
    throw new Error('Invalid file path');
  }

  const overviewContent = fs.readFileSync(overviewPath, 'utf8').trim();
  const rulesContent = fs.readFileSync(rulesPath, 'utf8').trim();
  const stateContent = fs.readFileSync(statePath, 'utf8').trim();

  const db = getDb(cwd);

  try {
    // 1. Search for matching decisions (FTS5)
    let decisions = searchDecisions(db, query);
    let usedFallbackDecisions = false;

    // Fallback: If no direct matches, grab the 5 most recent decisions for context
    if (decisions.length === 0) {
      decisions = getActiveDecisions(db).slice(0, 5);
      usedFallbackDecisions = true;
    }

    // 2. Search for matching chats (FTS5)
    const chats = searchChats(db, query).slice(0, 3); // top 3 chats for context size control

    closeDb();

    // 3. Format Decisions section
    let decisionsSection = 'No active decisions logged.';
    if (decisions.length > 0) {
      decisionsSection = decisions
        .map(d => {
          const dateStr = new Date(d.timestamp).toISOString().split('T')[0];
          return `- [${dateStr}] Decision: ${d.decision} (Reason: ${d.reason || 'N/A'})`;
        })
        .join('\n');
      if (usedFallbackDecisions) {
        decisionsSection = `(Recent Project Decisions)\n${decisionsSection}`;
      } else {
        decisionsSection = `(Search Matches for: "${query}")\n${decisionsSection}`;
      }
    }

    // 4. Format Chats section
    let chatsSection = '';
    if (chats.length > 0) {
      chatsSection = '\n=== RELATED PAST DISCUSSIONS ===\n' + chats
        .map(c => {
          const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
          const promptPreview = c.prompt.split('\n')[0];
          const responsePreview = c.response.split('\n')[0] || '';
          
          return `### [${dateStr}] Title: ${c.title}
- **Tags**: ${c.tags || 'none'}
- **User asked**: ${promptPreview}
- **Resolution/Reply**: ${responsePreview}`;
        })
        .join('\n\n') + '\n';
    }

    // 5. Compile final prompt template
    const enhancedPrompt = `[SYSTEM CONTEXT & NEUROMEMORY-AI PROJECT MEMORY - DO NOT RE-ASK ARCHITECTURE/INFRA QUESTIONS]

=== PROJECT OVERVIEW ===
${overviewContent}

=== GLOBAL RULES ===
${rulesContent}

=== RELEVANT PAST DECISIONS (Newest First) ===
${decisionsSection}
${chatsSection}
=== CURRENT STATE & SPRINT ISSUES ===
${stateContent}

=== USER QUERY ===
${query}
`;

    // 6. Copy to clipboard
    console.log('\x1b[36m%s\x1b[0m', 'Compiling context and copying to clipboard...');
    const copySuccess = copyToClipboard(enhancedPrompt, cwd);

    if (copySuccess) {
      console.log('\x1b[32m%s\x1b[0m', '✔ Enhanced prompt copied to system clipboard successfully!');
      console.log('\x1b[90m%s\x1b[0m', 'You can now paste (Ctrl+V) directly into Cursor or Claude Code.\n');
    } else {
      console.log('\x1b[31m%s\x1b[0m', '⚠ Could not copy to clipboard. Printing prompt below:\n');
    }

    // 7. Print preview to console
    console.log('\x1b[33m%s\x1b[0m', '=== PROMPT PREVIEW ===');
    console.log(enhancedPrompt);
    console.log('\x1b[33m%s\x1b[0m', '======================');

  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Error generating prompt:', err.message);
    try { closeDb(); } catch (_) {}
    process.exit(1);
  }
}
