import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { getActiveDecisions } from './db.js';

/**
 * Creates default template markdown files in `.nma/` if they don't exist.
 * @param {string} nmaDir - Path to .nma directory
 */
export function createTemplatesIfNotExists(nmaDir) {
  const overviewPath = path.join(nmaDir, 'project-overview.md');
  const rulesPath = path.join(nmaDir, 'rules.md');
  const statePath = path.join(nmaDir, 'current-state.md');

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
    fs.writeFileSync(
      rulesPath,
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
    fs.writeFileSync(
      statePath,
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
  const nmaDir = path.resolve(customCwd, '.nma');
  if (!fs.existsSync(nmaDir)) {
    fs.mkdirSync(nmaDir, { recursive: true });
  }

  const tempFile = path.join(nmaDir, 'temp_clip.txt');
  fs.writeFileSync(tempFile, text, 'utf8');

  try {
    // Windows powershell script to read UTF8 file and copy to system clipboard
    const powershellCmd = `powershell -NoProfile -Command "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Raw -Path '${tempFile}' | Set-Clipboard"`;
    execSync(powershellCmd, { stdio: 'ignore' });
    
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    return true;
  } catch (err) {
    // Cleanup if file still exists
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
  const nmaDir = path.resolve(customCwd, '.nma');
  
  // Ensure templates exist
  createTemplatesIfNotExists(nmaDir);

  // Read manual files
  const overviewContent = fs.readFileSync(path.join(nmaDir, 'project-overview.md'), 'utf8').trim();
  const rulesContent = fs.readFileSync(path.join(nmaDir, 'rules.md'), 'utf8').trim();
  const stateContent = fs.readFileSync(path.join(nmaDir, 'current-state.md'), 'utf8').trim();

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

  // Write out the compiled outputs
  fs.writeFileSync(path.join(customCwd, '.cursorrules'), compiledMarkdown, 'utf8');
  fs.writeFileSync(path.join(customCwd, 'claudecode.md'), compiledMarkdown, 'utf8');
  fs.writeFileSync(path.join(customCwd, 'nma-context.md'), compiledMarkdown, 'utf8');

  // Also update decisions.md inside .nma folder for user visibility
  const decisionsFileContent = `# NeuroMemory-AI Decisions Log (Newest First)

This file is automatically compiled from the NeuroMemory-AI database. Do not edit directly.

${decisionsSection}
`;
  fs.writeFileSync(path.join(nmaDir, 'decisions.md'), decisionsFileContent, 'utf8');

  return compiledMarkdown;
}
