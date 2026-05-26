import { getDb, getConfig, setConfig, closeDb } from '../db.js';

/**
 * CLI config handler.
 * @param {string} action - 'get', 'set', or 'list'
 * @param {string} key - Config key
 * @param {string} value - Config value
 * @param {object} [options]
 * @param {string} [options.cwd]
 */
export function configCommand(action, key, value, options = {}) {
  const cwd = options.cwd || process.cwd();
  const db = getDb(cwd);

  try {
    if (!action || action === 'list') {
      const config = getConfig(db);
      console.log('\x1b[35m%s\x1b[0m', '=== NeuroMemory-AI CONFIGURATIONS ===');
      const keys = Object.keys(config);
      if (keys.length === 0) {
        console.log('No configurations set yet.');
      } else {
        for (const k of keys) {
          console.log(`  \x1b[36m${k}\x1b[0m: ${config[k]}`);
        }
      }
      closeDb();
      return;
    }

    if (action === 'get') {
      if (!key) {
        console.error('\x1b[31m%s\x1b[0m', 'Error: Please specify the config key (e.g. nma config get openai_key).');
        closeDb();
        process.exit(1);
      }
      const config = getConfig(db);
      console.log(`${key}: ${config[key] !== undefined ? config[key] : '\x1b[90m(Not Set)\x1b[0m'}`);
      closeDb();
      return;
    }

    if (action === 'set') {
      if (!key || value === undefined) {
        console.error('\x1b[31m%s\x1b[0m', 'Error: Please specify both key and value (e.g. nma config set openai_key sk-...).');
        closeDb();
        process.exit(1);
      }
      setConfig(db, key, value);
      closeDb();
      console.log('\x1b[32m%s\x1b[0m', `✔ Configuration saved: ${key} = ${value}`);
      return;
    }

    console.error('\x1b[31m%s\x1b[0m', `Error: Unknown action "${action}". Available actions: get, set, list`);
    closeDb();
    process.exit(1);
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Error managing config:', err.message);
    try { closeDb(); } catch (_) {}
    process.exit(1);
  }
}
