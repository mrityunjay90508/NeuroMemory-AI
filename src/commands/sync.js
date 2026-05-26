import fs from 'node:fs';
import path from 'node:path';
import { getDb, insertChat, updateChat, closeDb } from '../db.js';
import { compileRhrFiles, getSafePath } from '../utils.js';

/**
 * Automatically syncs chats from the AntiGravity IDE brain logs into the current workspace's NeuroMemory-AI.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {boolean} [options.silent]
 */
export async function syncCommand(options = {}) {
  const cwd = options.cwd || process.cwd();
  const silent = !!options.silent;
  
  // Resolve AppData path for AntiGravity IDE — no user input; safe constant segments
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  // getSafePath enforces the directory boundary on the resolved path
  const brainDir = getSafePath(path.normalize(path.resolve(userProfile)), '.gemini', 'antigravity-ide', 'brain');

  // Path validated by getSafePath — safe to check existence
  if (!fs.existsSync(brainDir)) {
    if (!silent) {
      console.log('\x1b[33m%s\x1b[0m', 'No AntiGravity IDE workspace session logs found on this computer.');
    }
    return;
  }

  if (!silent) {
    console.log('\x1b[36m%s\x1b[0m', 'Scanning AntiGravity IDE for conversations matching this workspace...');
  }

  // Normalize workspace path for search comparison
  const normalizedCwd = cwd.replace(/\\/g, '/').toLowerCase();

  try {
    const db = getDb(cwd);
    const folders = fs.readdirSync(brainDir);
    let syncCount = 0;

    for (const folder of folders) {
      if (folder === '.' || folder === '..') continue;
      
      // getSafePath validates that folder resolves within brainDir — prevents traversal
      const transcriptPath = getSafePath(brainDir, folder, '.system_generated', 'logs', 'transcript.jsonl');
      // Path validated by getSafePath — safe to check and read
      if (!fs.existsSync(transcriptPath)) continue;

      // Read transcript file — path validated above via getSafePath
      let fileContent = '';
      try {
        fileContent = fs.readFileSync(transcriptPath, 'utf8');
      } catch (_) {
        continue;
      }

      const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
      const lineCount = lines.length;

      // Check if already synced and no new entries
      const checkStmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const prevLineCountVal = checkStmt.get(`synced_conv_lines_${folder}`);
      const prevLineCount = prevLineCountVal ? parseInt(prevLineCountVal.value, 10) : 0;

      if (lineCount > 0 && lineCount <= prevLineCount) {
        continue;
      }

      let currentPrompt = '';
      let currentResponse = '';
      let chatTitle = '';
      let belongsToWorkspace = false;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Check if workspace matches
          if (entry.content) {
            const lowerContent = entry.content.toLowerCase();
            if (lowerContent.includes(normalizedCwd) || lowerContent.includes(cwd.toLowerCase())) {
              belongsToWorkspace = true;
            }
          }

          if (entry.type === 'USER_INPUT') {
            let cleanPrompt = entry.content || '';
            // Parse out USER_REQUEST tags
            if (cleanPrompt.includes('<USER_REQUEST>')) {
              cleanPrompt = cleanPrompt.split('<USER_REQUEST>')[1].split('</USER_REQUEST>')[0].trim();
            }
            currentPrompt = cleanPrompt;
            chatTitle = cleanPrompt.split('\n')[0].substring(0, 60).trim();
          } 
          
          if (entry.type === 'PLANNER_RESPONSE' || entry.type === 'MODEL_RESPONSE') {
            currentResponse = entry.content || '';
          }
        } catch (_) {
          // Ignore individual parsing errors
        }
      }

      // If matches this workspace and has content, log or update it
      if (belongsToWorkspace && currentPrompt) {
        const existingIdVal = checkStmt.get(`synced_conv_id_${folder}`);
        const existingId = existingIdVal ? parseInt(existingIdVal.value, 10) : null;

        const chatData = {
          title: chatTitle || `Synced Chat ${folder.substring(0, 8)}`,
          prompt: currentPrompt,
          response: currentResponse || '(No response captured)',
          summary: `Synced from AntiGravity IDE Session: ${folder}`,
          tags: 'synced, antigravity'
        };

        let chatId = existingId;
        if (existingId) {
          updateChat(db, existingId, chatData);
        } else {
          chatId = insertChat(db, chatData);
        }

        // Save metadata to config
        const markStmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
        markStmt.run(`synced_conv_id_${folder}`, String(chatId));
        markStmt.run(`synced_conv_lines_${folder}`, String(lineCount));
        syncCount++;
      }
    }

    if (syncCount > 0) {
      if (!silent) {
        console.log('\x1b[32m%s\x1b[0m', `✔ Successfully synced ${syncCount} conversation(s) from AntiGravity IDE!`);
      }
      compileRhrFiles(db, cwd);
    } else {
      if (!silent) {
        console.log('\x1b[33m%s\x1b[0m', 'No new workspace conversations found to sync.');
      }
    }

    closeDb();
  } catch (err) {
    if (!silent) {
      console.error('\x1b[31m%s\x1b[0m', 'Error syncing conversations:', err.message);
    }
    try { closeDb(); } catch (_) {}
  }
}

