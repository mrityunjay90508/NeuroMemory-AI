import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { getActiveDecisions } from './db.js';

/**
 * Safely resolves and normalizes a path, ensuring it stays within baseDir boundaries.
 * @param {string} baseDir
 * @param {...string} segments
 * @returns {string} Safe resolved path
 */
export function getSafePath(baseDir, ...segments) {
  const normalizedBase = path.normalize(path.resolve(baseDir));
  const resolvedPath = path.normalize(path.resolve(normalizedBase, ...segments));
  if (!resolvedPath.startsWith(normalizedBase)) {
    throw new Error('Directory traversal attempt detected');
  }
  return resolvedPath;
}

/**
 * Creates default template markdown files in `.nma/` if they don't exist.
 * @param {string} nmaDir - Path to .nma directory
 */
export function createTemplatesIfNotExists(nmaDir) {
  // Validate and resolve all paths through getSafePath before any filesystem access
  const safeNmaDir = path.normalize(path.resolve(nmaDir));
  const overviewPath = getSafePath(safeNmaDir, 'project-overview.md');
  const rulesPath = getSafePath(safeNmaDir, 'rules.md');
  const statePath = getSafePath(safeNmaDir, 'current-state.md');

  if (!fs.existsSync(overviewPath)) {
    fs.writeFileSync(
      overviewPath,
      `# NeuroMemory-AI Project Overview

## Tech Stack
- **Frontend**: Next.js / React (TypeScript)
- **Backend**: Node.js
- **Database**: PostgreSQL / SQLite
- **Caching/State**: Redis / Zustand
- **Auth**: JWT / Cookie-based sessions

## Core Architecture Description
(Describe your folder structure, API endpoints, rendering strategy - e.g., Server-Side Rendering (SSR), etc.)
`,
      'utf8'
    );
  }

  if (!fs.existsSync(rulesPath)) {
    const safeRulesPath = getSafePath(safeNmaDir, 'rules.md');
    fs.writeFileSync(
      safeRulesPath,
      `# NeuroMemory-AI AI Rules & Guidelines

- **No Repeated Questions**: Never ask basic infrastructure or stack questions that are already defined in the Project Overview or decisions log.
- **SSR Assumptions**: Assume Server-Side Rendering is active and pre-configured unless explicitly asked to modify it.
- **Code Standards**: Prefer clean, structured, type-safe, and self-documenting code.
- **State Management**: Keep components focused. Minimize client-side state unless interactive client interactions are required.
`,
      'utf8'
    );
  }

  if (!fs.existsSync(statePath)) {
    const safeStatePath = getSafePath(safeNmaDir, 'current-state.md');
    fs.writeFileSync(
      safeStatePath,
      `# NeuroMemory-AI Current Sprint & Active Issues

## Active Sprint / Current Focus
- [ ] Initializing NeuroMemory-AI System for tracking context.

## Known Issues / Bugs
- [ ] Hydration mismatches (Example - edit this as bugs arise).
`,
      'utf8'
    );
  }
}

/**
 * Copies text to the Windows Clipboard using PowerShell.
 * @param {string} text - The text content to copy.
 * @param {string} [customCwd] - Target directory
 * @returns {boolean} Success state
 */
export function copyToClipboard(text, customCwd = process.cwd()) {
  // Always resolve and normalize cwd before any path construction
  const normalizedCwd = path.normalize(path.resolve(customCwd));
  const safeNmaDir = getSafePath(normalizedCwd, '.nma');
  if (!fs.existsSync(safeNmaDir)) {
    fs.mkdirSync(safeNmaDir, { recursive: true });
  }

  // Use getSafePath to guarantee the temp file stays within .nma/
  const tempFile = getSafePath(safeNmaDir, 'temp_clip.txt');
  fs.writeFileSync(tempFile, text, 'utf8');

  try {
    // Windows powershell script to read UTF8 file and copy to system clipboard
    const powershellCmd = `powershell -NoProfile -Command "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Raw -Path '${tempFile}' | Set-Clipboard"`;
    execSync(powershellCmd, { stdio: 'ignore' });
    
    // Clean up temp file — path already validated via getSafePath above
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    return true;
  } catch (err) {
    // Cleanup if file still exists — path already validated via getSafePath above
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
    console.error('Failed to copy to clipboard via PowerShell:', err.message);
    return false;
  }
}

/**
 * Compiles all project context data (Markdown files + SQLite decisions log)
 * into .cursorrules, claudecode.md, and nma-context.md.
 * @param {DatabaseSync} db
 * @param {string} [customCwd]
 * @returns {string} The compiled markdown context string
 */
export function compileRhrFiles(db, customCwd = process.cwd()) {
  // Resolve and normalize workspace root before any path construction
  const normalizedCwd = path.normalize(path.resolve(customCwd));
  // All .nma/ paths are bounded to normalizedCwd via getSafePath
  const safeNmaDir = getSafePath(normalizedCwd, '.nma');

  // Ensure templates exist
  createTemplatesIfNotExists(safeNmaDir);

  // Resolve each file path through getSafePath to enforce boundary check
  const overviewPath = getSafePath(safeNmaDir, 'project-overview.md');
  const rulesPath = getSafePath(safeNmaDir, 'rules.md');
  const statePath = getSafePath(safeNmaDir, 'current-state.md');

  // All paths were validated by getSafePath — safe to read
  const overviewContent = fs.readFileSync(overviewPath, 'utf8').trim();
  const rulesContent = fs.readFileSync(rulesPath, 'utf8').trim();
  const stateContent = fs.readFileSync(statePath, 'utf8').trim();

  // Read active decisions from SQLite database (newest first)
  const decisions = getActiveDecisions(db);
  
  let decisionsSection = '=== NO ACTIVE DECISIONS LOGGED YET ===';
  if (decisions.length > 0) {
    decisionsSection = decisions
      .map(d => {
        const dateStr = new Date(d.timestamp).toISOString().split('T')[0];
        return `### [${dateStr}] Decision: ${d.decision}
- **Status**: ${d.status}
- **Reason/Context**: ${d.reason || 'No additional reason provided.'}`;
      })
      .join('\n\n');
  }

  const compiledMarkdown = `# NEUROMEMORY-AI SYSTEM CONTEXT & PROJECT MEMORY
> [!IMPORTANT]
> DO NOT ASK BASIC INFRASTRUCTURE OR STACK QUESTIONS ALREADY STATED BELOW. Assume these architectural rules and past decisions remain active unless explicitly updated.

==================================================
=== 1. PROJECT OVERVIEW ===
==================================================
${overviewContent}

==================================================
=== 2. GLOBAL RULES & INSTRUCTIONS ===
==================================================
${rulesContent}

==================================================
=== 3. ARCHITECTURAL DECISIONS (Newest First) ===
==================================================
${decisionsSection}

==================================================
=== 4. CURRENT STATE & SPRINT ISSUES ===
==================================================
${stateContent}
`;

  // Resolve all output paths through getSafePath before writing
  const cursorrulesPath = getSafePath(normalizedCwd, '.cursorrules');
  const claudecodePath = getSafePath(normalizedCwd, 'claudecode.md');
  const nmacontextPath = getSafePath(normalizedCwd, 'nma-context.md');
  // Decisions file lives inside .nma/ — bounded to safeNmaDir
  const decisionsPath = getSafePath(safeNmaDir, 'decisions.md');

  // All paths validated by getSafePath — safe to write
  fs.writeFileSync(cursorrulesPath, compiledMarkdown, 'utf8');
  fs.writeFileSync(claudecodePath, compiledMarkdown, 'utf8');
  fs.writeFileSync(nmacontextPath, compiledMarkdown, 'utf8');

  // Also update decisions.md inside .nma folder for user visibility
  const decisionsFileContent = `# NeuroMemory-AI Decisions Log (Newest First)

This file is automatically compiled from the NeuroMemory-AI database. Do not edit directly.

${decisionsSection}
`;
  // Path validated by getSafePath above — safe to write
  fs.writeFileSync(decisionsPath, decisionsFileContent, 'utf8');

  return compiledMarkdown;
}

