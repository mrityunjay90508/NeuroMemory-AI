// Suppress experimental warnings (e.g. from node:sqlite)
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning') return;
  console.warn(warning.stack || warning.message);
});

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
const { 
  getDb, 
  closeDb, 
  insertChat, 
  insertDecision, 
  getActiveDecisions, 
  getAllChats,
  searchChats, 
  searchDecisions,
  setConfig,
  getConfig
} = await import('../src/db.js');
const { compileRhrFiles, copyToClipboard } = await import('../src/utils.js');

const testCwd = path.resolve(process.cwd(), '.nma_test_dir');

// Cleanup helper
function cleanup() {
  if (fs.existsSync(testCwd)) {
    fs.rmSync(testCwd, { recursive: true, force: true });
  }
}

async function runTests() {
  console.log('\x1b[36m%s\x1b[0m', '=== Running NeuroMemory-AI Tests ===');
  
  // Ensure fresh folder
  cleanup();
  fs.mkdirSync(testCwd, { recursive: true });

  try {
    // 1. Initialize Database test
    console.log('Testing: Database and Folder Initialization...');
    const db = getDb(testCwd);
    assert.ok(fs.existsSync(path.join(testCwd, '.nma')), '.nma folder should be created');
    assert.ok(fs.existsSync(path.join(testCwd, '.nma', 'nma.db')), 'nma.db file should be created');

    // 2. Test configuration set and get
    console.log('Testing: Configurations...');
    setConfig(db, 'test_key', 'test_value');
    const config = getConfig(db);
    assert.strictEqual(config.test_key, 'test_value', 'Config value should match set value');

    // 3. Test insert chats and decisions
    console.log('Testing: Logging Chats and Decisions...');
    // Log Chat 1 (older)
    const chat1Id = insertChat(db, {
      title: 'Setup Database Connection',
      prompt: 'How to setup PostgreSQL connection pool in Node.js?',
      response: 'Use pg.Pool and keep single instance.',
      tags: 'postgres, database'
    });
    assert.strictEqual(typeof chat1Id, 'number', 'Insert chat should return ID');

    // Log Decision 1 linked to Chat 1
    const dec1Id = insertDecision(db, {
      decision: 'Use pg.Pool for database',
      reason: 'Prevent connection leaks',
      source_chat_id: chat1Id
    });
    assert.strictEqual(typeof dec1Id, 'number', 'Insert decision should return ID');

    // Wait 1 second to ensure timestamp difference for sorting test
    await new Promise(r => setTimeout(r, 1000));

    // Log Chat 2 (newer)
    const chat2Id = insertChat(db, {
      title: 'Configure Redis Caching',
      prompt: 'Explain caching strategy for SSR pages.',
      response: 'Use Redis cache at middleware level with 60s TTL.',
      tags: 'redis, ssr, cache'
    });

    // Log Decision 2 linked to Chat 2
    const dec2Id = insertDecision(db, {
      decision: 'Cache SSR pages in Redis',
      reason: 'Reduce load and hydration latency',
      source_chat_id: chat2Id
    });

    // 4. Test newest-first sorting
    console.log('Testing: Chronological Retrieval (Newest First)...');
    const decisions = getActiveDecisions(db);
    assert.strictEqual(decisions.length, 2, 'Should return 2 decisions');
    assert.strictEqual(decisions[0].id, dec2Id, 'Newest decision should be returned first');
    assert.strictEqual(decisions[1].id, dec1Id, 'Oldest decision should be returned second');

    const chats = getAllChats(db);
    assert.strictEqual(chats.length, 2, 'Should return 2 chats');
    assert.strictEqual(chats[0].id, chat2Id, 'Newest chat should be returned first');
    assert.strictEqual(chats[1].id, chat1Id, 'Oldest chat should be returned second');

    // 5. Test FTS5 Search queries
    console.log('Testing: FTS5 Full-Text Search...');
    const searchResChat = searchChats(db, 'caching strategy');
    assert.strictEqual(searchResChat.length, 1, 'Should find 1 matching chat');
    assert.strictEqual(searchResChat[0].id, chat2Id, 'Matched chat should be the Redis one');

    const searchResDec = searchDecisions(db, 'connection leaks');
    assert.strictEqual(searchResDec.length, 1, 'Should find 1 matching decision');
    assert.strictEqual(searchResDec[0].id, dec1Id, 'Matched decision should be the pg.Pool one');

    // 6. Test Compilation
    console.log('Testing: Project File Compilation...');
    const compiledContent = compileRhrFiles(db, testCwd);
    assert.ok(fs.existsSync(path.join(testCwd, '.cursorrules')), '.cursorrules file should compile');
    assert.ok(fs.existsSync(path.join(testCwd, 'claudecode.md')), 'claudecode.md file should compile');
    assert.ok(fs.existsSync(path.join(testCwd, 'nma-context.md')), 'nma-context.md file should compile');
    assert.ok(fs.existsSync(path.join(testCwd, '.nma', 'decisions.md')), 'decisions.md inside .nma should compile');
    
    assert.ok(compiledContent.includes('Cache SSR pages in Redis'), 'Compiled file should contain decision');
    assert.ok(compiledContent.includes('Use pg.Pool for database'), 'Compiled file should contain decision');

    // 7. Test Clipboard Copy
    console.log('Testing: Windows Clipboard copy mechanism...');
    const copyOk = copyToClipboard('NeuroMemory-AI Test Clipboard String', testCwd);
    if (copyOk) {
      console.log('  ✔ Clipboard helper executed successfully (requires Windows environment to fully copy)');
    } else {
      console.log('  ⚠ Clipboard helper failed to execute (expected if not in standard Windows CLI context)');
    }

    closeDb();
    console.log('\n\x1b[32m%s\x1b[0m', '✔ All test assertions passed successfully!');
  } catch (err) {
    console.error('\n\x1b[31m%s\x1b[0m', '❌ Test suite failed:', err);
    try { closeDb(); } catch (_) {}
    cleanup();
    process.exit(1);
  }

  // Cleanup temp files
  cleanup();
}

runTests();
