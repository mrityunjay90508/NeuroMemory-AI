#!/usr/bin/env node

// Suppress experimental warnings (e.g. from node:sqlite)
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning') return;
  console.warn(warning.stack || warning.message);
});

const { initCommand } = await import('../src/commands/init.js');
const { logCommand } = await import('../src/commands/log.js');
const { searchCommand } = await import('../src/commands/search.js');
const { promptCommand } = await import('../src/commands/prompt.js');
const { compileCommand } = await import('../src/commands/compile.js');
const { configCommand } = await import('../src/commands/config.js');
const { syncCommand } = await import('../src/commands/sync.js');
const { watchCommand } = await import('../src/commands/watch.js');

// Simple custom arguments parser (keeps project zero-dependency)
function parseArgs(rawArgs) {
  const args = [...rawArgs];
  const parsed = {
    _: []
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      let val = parts[1];
      if (val === undefined && args.length > 0 && !args[0].startsWith('-')) {
        val = args.shift();
      }
      Object.defineProperty(parsed, key, {
        value: val !== undefined ? val : true,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } else if (arg.startsWith('-')) {
      // Handle shorthand flags (e.g. -f value, -d value)
      const keyMap = {
        '-f': 'file',
        '-t': 'title',
        '-g': 'tags',
        '-d': 'decision',
        '-r': 'reason',
        '-h': 'help',
        '-v': 'version'
      };
      if (Object.prototype.hasOwnProperty.call(keyMap, arg)) {
        const mappedKey = Reflect.get(keyMap, arg);
        let val = true;
        if (args.length > 0 && !args[0].startsWith('-')) {
          val = args.shift();
        }
        Object.defineProperty(parsed, mappedKey, {
          value: val,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

const rawArgs = process.argv.slice(2);
const options = parseArgs(rawArgs);

const command = options._[0];

// Help menu printing
function showHelp() {
  console.log(`
\x1b[36mNeuroMemory-AI (v1.0.0)\x1b[0m
Persistent memory and context layer for AI vibe-coding platforms.

\x1b[33mUsage:\x1b[0m
  nma <command> [options]
  neuromemory-ai <command> [options]

\x1b[33mCommands:\x1b[0m
  \x1b[32minit\x1b[0m                          Initialize NeuroMemory-AI workspace (.nma/ folders & templates)
  \x1b[32mlog\x1b[0m                           Log a new conversation/issue to the memory store
                                \x1b[90mOptions:
                                  -f, --file <path>       Load log from chat text file
                                  -t, --title <text>      Specify log title
                                  -g, --tags <text>       Specify tags (comma-separated)
                                  -d, --decision <text>   Specify a key architectural decision
                                  -r, --reason <text>     Specify the reason for the decision\x1b[0m
  \x1b[32mprompt <query>\x1b[0m                 Compile context + user query & copy to Windows clipboard
  \x1b[32msearch <query>\x1b[0m                 Search logged conversations and decisions via SQLite FTS5
  \x1b[32msync\x1b[0m                          Automatically sync recent conversations from AntiGravity IDE
  \x1b[32mwatch\x1b[0m                         Watch directory and sync conversations automatically in real-time
  \x1b[32mcompile\x1b[0m                       Manually rebuild .cursorrules, claudecode.md, nma-context.md
  \x1b[32mconfig [list|get|set] <args>\x1b[0m  Manage system configuration key-values

\x1b[33mExamples:\x1b[0m
  $ nma init
  $ nma log -t "Setup Redis Cache" -d "Redis caching for SSR" -g "ssr,redis"
  $ nma prompt "analytics hydration mismatch"
  $ nma sync
`);
}

if (options.help || rawArgs.length === 0 || command === 'help') {
  showHelp();
  process.exit(0);
}

if (options.version || command === 'version') {
  console.log('NeuroMemory-AI v1.0.0');
  process.exit(0);
}

// Command router
switch (command) {
  case 'init':
    initCommand();
    break;

  case 'log':
    logCommand(options);
    break;

  case 'search': {
    const query = options._.slice(1).join(' ');
    searchCommand(query);
    break;
  }

  case 'prompt': {
    const query = options._.slice(1).join(' ');
    promptCommand(query);
    break;
  }

  case 'sync':
    syncCommand();
    break;
  
  case 'watch':
    watchCommand();
    break;

  case 'compile':
    compileCommand();
    break;

  case 'config': {
    const action = options._[1] || 'list'; // list, get, set
    const key = options._[2];
    const value = options._[3];
    configCommand(action, key, value);
    break;
  }

  default:
    console.error('\x1b[31m%s\x1b[0m', `Error: Unknown command "${command}".`);
    showHelp();
    process.exit(1);
}
