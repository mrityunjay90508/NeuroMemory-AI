import fs from 'node:fs';
import path from 'node:path';
import { syncCommand } from './sync.js';

/**
 * Watches the AntiGravity IDE brain logs directory for changes and automatically triggers a sync.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {boolean} [options.silent]
 */
export async function watchCommand(options = {}) {
  const cwd = options.cwd || process.cwd();
  
  // Resolve AppData path for AntiGravity IDE
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const brainDir = path.join(userProfile, '.gemini', 'antigravity-ide', 'brain');

  if (!fs.existsSync(brainDir)) {
    console.log('\x1b[33m%s\x1b[0m', 'No AntiGravity IDE workspace session logs found to watch.');
    return;
  }

  console.log('\x1b[36m%s\x1b[0m', '🧠 NeuroMemory-AI Watcher started! 🕵️‍♂️');
  console.log('\x1b[90m%s\x1b[0m', `Watching for conversation logs in: ${brainDir}`);
  console.log('\x1b[90m%s\x1b[0m', 'Press Ctrl+C to stop.');

  // Run an initial sync on startup
  try {
    console.log('[Watch] Running initial sync...');
    await syncCommand({ cwd, silent: true });
    console.log('[Watch] Initial sync complete.');
  } catch (err) {
    console.error('[Watch] Error during initial sync:', err.message);
  }

  let debounceTimeout = null;

  const watcher = fs.watch(brainDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('transcript.jsonl')) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        try {
          console.log(`[Watch] Log update detected. Syncing...`);
          await syncCommand({ cwd, silent: true });
          console.log('[Watch] Auto-sync complete.');
        } catch (err) {
          console.error('[Watch] Error during auto-sync:', err.message);
        }
      }, 1000); // 1-second debounce
    }
  });

  // Keep process alive
  process.on('SIGINT', () => {
    watcher.close();
    console.log('\n[Watch] Watcher stopped.');
    process.exit(0);
  });
}
