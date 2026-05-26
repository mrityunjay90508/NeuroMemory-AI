# 🧠 NeuroMemory-AI (`nma`)
> **Persistent Memory & Context Layer for AI Vibe-Coding Platforms**
> 
> **Made by [WebVibezzz](https://github.com/mrityunjay90508)**

**NeuroMemory-AI** is a zero-dependency, local-first context and memory manager. It tracks your tech stack, coding rules, sprint issues, and architectural decisions, ensuring that AI coding assistants (like Cursor, Claude Code, Windsurf, or AntiGravity) stay aligned with past decisions.

No more repeating your tech stack or explaining *"why we did X"* again and again. 

---

## 🚀 Key Features

* **Zero Dependency**: Runs purely on native Node.js and the built-in `node:sqlite` database. Extremely fast, lightweight, and requires no npm installs.
* **Auto-Sync Chats (`nma sync`)**: Scans your local AntiGravity IDE brain storage, maps files referenced in conversation histories to the current workspace, parses user/model steps, and imports chats into SQLite automatically.
* **Full-Text Search (SQLite FTS5)**: Automatically indexes your chats, tags, and decisions using SQLite FTS5 with BM25 relevance ranking.
* **Clipboard Context Injector**: Compiles matched context, tech stack rules, and recent decisions into a structured prompt context block and copies it to your clipboard automatically. Paste it (`Ctrl+V`) into your AI chat window.
* **Auto-Compile Rules**: Merges manual docs with database logs into standard configuration formats (`.cursorrules`, `claudecode.md`, `nma-context.md`) that vibe-coding IDEs read natively.
* **Chronological Ordering**: Saves your chats and decisions, keeping the newest information first so AI tools receive the most updated context.

---

## 📦 Installation & Setup

You can install this CLI globally directly from GitHub, or link it locally for development.

### Option A: Install from GitHub (Public URL)
Once you push this to your public GitHub repo, any developer can install it globally via:
```bash
npm install -g YOUR_GITHUB_USERNAME/NeuroMemory-AI
```

### Option B: Local Development Setup
1. Clone the repository to your local machine.
2. Open terminal in the cloned folder and run:
   ```bash
   npm link
   ```

Now the short command **`nma`** (or **`neuromemory-ai`**) will be available globally in your terminal!

---

## 🛠 Step-by-Step Usage Guide

Here is exactly how to use NeuroMemory-AI in your daily coding workflow:

### Step 1: Initialize NeuroMemory-AI in your Project
Go to your project repository (e.g., your Next.js app folder) and run:
```bash
nma init
```
This will create a `.nma/` directory inside your repository containing the following files:
* `.nma/nma.db`: Your local SQLite database containing logs and config.
* `.nma/project-overview.md`: **[User Editable]** Open this file and write your tech stack, database details, and core folder structure here.
* `.nma/rules.md`: **[User Editable]** Open this and add coding standards or prompts you want the AI to always follow.
* `.nma/current-state.md`: **[User Editable]** Write down current bugs, issues, or active sprint tasks.

It also compiles these files and outputs `.cursorrules`, `claudecode.md`, and `nma-context.md` in the root of your project folder.

### Step 2: Code Normally with your AI Coding Assistant
Use Cursor, Claude Code, ChatGPT, or AntiGravity IDE to write code, debug issues, and design architecture.

### Step 3: Automatically Sync Conversations
After finishing a chat session where you made an architectural decision or resolved a tricky bug, run:
```bash
nma sync
```
NeuroMemory-AI will automatically search the IDE's history logs, find conversations belonging to your current project directory, extract the prompt and response, and import them into `.nma/nma.db`. It then rebuilds your rule files.

> [!TIP]
> **Manual Logging Fallback**: If you want to manually log a custom chat or decision without syncing, just type:
> `nma log` (starts the interactive wizard) or
> `nma log -t "Title" -d "Decision Text" -g "tags"` (saves it instantly).

### Step 4: Ask AI Context-Aware Questions (`nma prompt`)
When starting a new conversation or working on a related feature, run:
```bash
nma prompt "your issue description"
```
* **Example**: `nma prompt "Slow API on dashboard hydration"`
* **What happens**: NeuroMemory-AI searches your SQLite database for recent caching/hydration decisions. It merges this context with your `project-overview.md` and copies the resulting prompt to your clipboard.
* **To Use**: Just press **`Ctrl + V` (Paste)** into Cursor or Claude Code! The AI will immediately understand the context of all past decisions.

---

## 🤝 Team Sharing (Zero Setup for other developers)

One of the best parts about NeuroMemory-AI is that **other developers on your team don't need to install NeuroMemory-AI** to benefit from it!

1. When you run `nma sync` or `nma compile`, it generates `.cursorrules` and `claudecode.md` in the project root.
2. **Commit these compiled files to your Git repository** (`git add .cursorrules claudecode.md`).
3. When another developer clones your project and opens it in Cursor or Claude Code, their AI coding assistant will **automatically read the compiled rules** and know all the past architectural decisions instantly, without them running a single command!

---

## 📁 Repository Directory Structure

```
your-project-repo/
├── .nma/
│   ├── nma.db                 # Local SQLite DB
│   ├── project-overview.md    # Tech stack details (Edit this!)
│   ├── rules.md               # Prompt guidelines & AI constraints (Edit this!)
│   ├── current-state.md       # Current bugs & active tasks (Edit this!)
│   └── decisions.md           # [Auto-Generated] Log of architectural decisions
│
├── .cursorrules               # Compiled rules (Automatically read by Cursor)
├── claudecode.md              # Compiled rules (Automatically read by Claude Code)
└── nma-context.md             # Compiled general context reference file
```

---

## 🧩 Injected Prompt Example

When you run `nma prompt "caching mismatch"`, this is the exact text copied to your clipboard:

```markdown
[SYSTEM CONTEXT & NEUROMEMORY-AI PROJECT MEMORY - DO NOT RE-ASK ARCHITECTURE/INFRA QUESTIONS]

=== PROJECT OVERVIEW ===
# NeuroMemory-AI Project Overview
- Frontend: Next.js (SSR)
- Caching: Redis

=== GLOBAL RULES ===
- No Repeated Questions: Never ask basic infrastructure or stack questions.
- SSR Assumptions: Assume Server-Side Rendering is active.

=== RELEVANT PAST DECISIONS (Newest First) ===
(Search Matches for: "caching mismatch")
- [2026-05-26] Decision: Use Redis caching for SSR pages. (Reason: Resolve hydration mismatches.)

=== CURRENT STATE & SPRINT ISSUES ===
- Hydration mismatches (caching error on dashboard).

=== USER QUERY ===
caching mismatch
```
