import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { getDb, insertChat, insertDecision, closeDb } from '../db.js';
import { compileRhrFiles } from '../utils.js';

// Helper for prompting the user for input
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

// Helper for capturing multiline input
function askMultiline(promptMessage) {
  console.log(promptMessage);
  console.log('\x1b[90m%s\x1b[0m', '(Type "\\done" on a new line and press Enter when finished)');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const lines = [];

  return new Promise((resolve) => {
    rl.on('line', (line) => {
      if (line.trim() === '\\done') {
        rl.close();
        resolve(lines.join('\n').trim());
      } else {
        lines.push(line);
      }
    });
  });
}

/**
 * Handles logging a conversation.
 * @param {object} args - Command arguments
 * @param {string} [args.file] - File path to read conversation from
 * @param {string} [args.title] - Chat title
 * @param {string} [args.tags] - Comma-separated tags
 * @param {string} [args.decision] - Immediate associated decision
 * @param {string} [args.reason] - Decision reason
 * @param {string} [args.cwd] - Target working directory
 */
export async function logCommand(args = {}) {
  const cwd = args.cwd || process.cwd();
  let title = args.title || '';
  let promptText = '';
  let responseText = '';
  let tags = args.tags || '';
  let decisionText = args.decision || '';
  let decisionReason = args.reason || '';

  // 1. Reading from file if provided
  if (args.file) {
    const filePath = path.resolve(cwd, args.file);
    if (!fs.existsSync(filePath)) {
      console.error('\x1b[31m%s\x1b[0m', `Error: File not found at ${filePath}`);
      process.exit(1);
    }
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Attempt to split content by standard separators (e.g. USER/PROMPT vs ASSISTANT/RESPONSE)
    const promptSeparator = /===?\s*PROMPT\s*===?|###?\s*User\b/i;
    const responseSeparator = /===?\s*RESPONSE\s*===?|###?\s*(Assistant|AI|Response)\b/i;

    if (responseSeparator.test(fileContent)) {
      const parts = fileContent.split(responseSeparator);
      const firstPart = parts[0] || '';
      responseText = parts[1] || '';

      if (promptSeparator.test(firstPart)) {
        promptText = firstPart.split(promptSeparator)[1] || '';
      } else {
        promptText = firstPart;
      }
    } else {
      promptText = fileContent;
      responseText = '';
    }

    // Clean up carriage returns
    promptText = promptText.trim();
    responseText = responseText.trim();

    console.log('\x1b[36m%s\x1b[0m', `✔ Read chat log from file: ${args.file}`);
  }

  // 2. Interactive prompt fallback
  if (!promptText) {
    promptText = await askMultiline('\x1b[36mEnter user prompt / issue details:\x1b[0m');
  }

  if (!responseText && !args.file) {
    responseText = await askMultiline('\x1b[36mEnter AI response / resolution:\x1b[0m');
  }

  if (!title) {
    title = await askQuestion('\x1b[36mEnter a short title for this log/issue:\x1b[0m ');
    if (!title) {
      title = `Log on ${new Date().toISOString().split('T')[0]}`;
    }
  }

  if (!tags && !args.tags) {
    tags = await askQuestion('\x1b[36mEnter tags (comma-separated, e.g., ssr, caching):\x1b[0m ');
  }

  // Quick decision check
  if (!decisionText && !args.decision) {
    const logDecision = await askQuestion('\x1b[36mDid you make any architectural decisions in this chat? (y/n):\x1b[0m ');
    if (logDecision.toLowerCase() === 'y' || logDecision.toLowerCase() === 'yes') {
      decisionText = await askQuestion('\x1b[36mEnter the decision:\x1b[0m ');
      decisionReason = await askQuestion('\x1b[36mEnter the reason for this decision (optional):\x1b[0m ');
    }
  }

  // 3. Save to SQLite database
  try {
    const db = getDb(cwd);

    // Save chat
    const chatId = insertChat(db, {
      title,
      prompt: promptText,
      response: responseText,
      summary: decisionText ? `Decision: ${decisionText}` : '',
      tags
    });

    // Save decision if present
    if (decisionText) {
      insertDecision(db, {
        decision: decisionText,
        reason: decisionReason || `Logged with chat: ${title}`,
        status: 'active',
        source_chat_id: chatId
      });
      console.log('\x1b[32m%s\x1b[0m', `✔ Logged decision: "${decisionText}"`);
    }

    // Compile markdown files
    compileRhrFiles(db, cwd);
    closeDb();

    console.log('\x1b[32m%s\x1b[0m', '✔ Successfully logged chat and compiled NeuroMemory-AI files!');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Error saving chat:', err.message);
    process.exit(1);
  }
}
