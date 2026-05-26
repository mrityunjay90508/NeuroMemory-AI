import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { getDb, insertChat, closeDb } from '../db.js';
import { compileRhrFiles } from '../utils.js';

/**
 * Automatically syncs chats from the AntiGravity IDE brain logs into the current workspace's NeuroMemory-AI.
 * @param {object} [options]
 * @param {string} [options.cwd]
 */
export async function syncCommand(options = {}) {
  const cwd = options.cwd || process.cwd();
  
  // Resolve AppData path for AntiGravity IDE
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const brainDir = path.join(userProfile, '.gemini', 'antigravity-ide', 'brain');

  if (!fs.existsSync(brainDir)) {
    console.log('\x1b[33m%s\x1b[0m', 'No AntiGravity IDE workspace session logs found on this computer.');
    return;
  }

  console.log('\x1b[36m%s\x1b[0m', 'Scanning AntiGravity IDE for conversations matching this workspace...');

  // Normalize workspace path for search comparison
  const normalizedCwd = cwd.replace(/\\/g, '/').toLowerCase();

  try {
    const db = getDb(cwd);
    const folders = fs.readdirSync(brainDir);
    let syncCount = 0;

    for (const folder of folders) {
      const transcriptPath = path.join(brainDir, folder, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(transcriptPath)) continue;

      // Check if already synced
      const checkStmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const isSynced = checkStmt.get(`synced_conv_${folder}`);
      if (isSynced) continue;

      // Parse JSONL file
      const fileStream = fs.createReadStream(transcriptPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentPrompt = '';
      let currentResponse = '';
      let chatTitle = '';
      let belongsToWorkspace = false;

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);

          // We check the first step's content or metadata for workspace directory path matching
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
          // Ignore parse errors on individual lines
        }
      }

      // If matches this workspace and has content, log it
      if (belongsToWorkspace && currentPrompt) {
        insertChat(db, {
          title: chatTitle || `Synced Chat ${folder.substring(0, 8)}`,
          prompt: currentPrompt,
          response: currentResponse || '(No response captured)',
          summary: `Synced from AntiGravity IDE Session: ${folder}`,
          tags: 'synced, antigravity'
        });

        // Mark as synced in config
        const markStmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
        markStmt.run(`synced_conv_${folder}`, 'true');
        syncCount++;
      }
    }

    if (syncCount > 0) {
      console.log('\x1b[32m%s\x1b[0m', `✔ Successfully synced ${syncCount} conversation(s) from AntiGravity IDE!`);
      compileRhrFiles(db, cwd);
    } else {
      console.log('\x1b[33m%s\x1b[0m', 'No new workspace conversations found to sync.');
    }

    closeDb();
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Error syncing conversations:', err.message);
    try { closeDb(); } catch (_) {}
  }
}
