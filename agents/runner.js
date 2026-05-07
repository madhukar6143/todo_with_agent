/**
 * Shared agent runner — used by both server.js and cli.js
 * UI Agent → QA Agent → Merge Agent (waits for human approval)
 */

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const client = new Anthropic();
const ROOT   = path.resolve(import.meta.dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function readFile(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
}

function writeFile(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function run(cmd, cwd = ROOT) {
  try {
    return { ok: true, output: execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, output: (e.stdout || '') + '\n' + (e.stderr || '') };
  }
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function claude(system, user) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return res.content[0].text;
}

function sourceSnapshot() {
  return [
    'frontend/src/App.jsx',
    'frontend/src/index.css',
    'frontend/src/components/AddTodo.jsx',
    'frontend/src/components/TodoItem.jsx',
    'frontend/src/components/FilterBar.jsx',
    'frontend/src/components/TodoList.jsx',
  ]
    .map((f) => `### ${f}\n\`\`\`\n${readFile(f) ?? '(not found)'}\n\`\`\``)
    .join('\n\n');
}

// ── AGENT 1: UI ──────────────────────────────────────────────────────────────

async function uiAgent(task) {
  console.log('\n🎨  [UI Agent] analysing task and editing files...');

  const response = await claude(
    `You are a frontend UI engineer for a React + Tailwind CSS todo app.
Your ONLY job: implement the UI change by editing source files.
Respond with a JSON array of edits: [{ "file": "relative/path", "content": "full file content" }]
Only include files that actually need to change. Output valid JSON only — no explanation.`,
    `Current source:\n\n${sourceSnapshot()}\n\n---\nTask: ${task}`
  );

  let edits;
  try {
    edits = JSON.parse(response.match(/\[[\s\S]*\]/)[0]);
  } catch {
    throw new Error('UI Agent returned invalid JSON:\n' + response);
  }

  for (const { file, content } of edits) {
    writeFile(file, content);
    console.log(`  ✏️   Edited: ${file}`);
  }

  return edits.map((e) => e.file);
}

// ── AGENT 2: QA ──────────────────────────────────────────────────────────────

async function qaAgent(changedFiles) {
  console.log('\n🧪  [QA Agent] running test suites...');

  const fe = run('npm test', path.join(ROOT, 'frontend'));
  const be = run('npm test', path.join(ROOT, 'backend'));

  const feLabel = fe.ok ? '✅ PASS' : '❌ FAIL';
  const beLabel = be.ok ? '✅ PASS' : '❌ FAIL';
  console.log(`  Frontend (Vitest):        ${feLabel}`);
  console.log(`  Backend  (Jest+Supertest): ${beLabel}`);

  const report = await claude(
    'You are a QA engineer. Write a concise 3–5 line QA report based on the test output.',
    `Changed: ${changedFiles.join(', ')}\n\nFrontend:\n${fe.output}\n\nBackend:\n${be.output}`
  );

  console.log('\n📋  QA Report:\n' + report);
  return { passed: fe.ok && be.ok, report };
}

// ── AGENT 3: MERGE ───────────────────────────────────────────────────────────

async function mergeAgent(task, changedFiles, autoMerge) {
  console.log('\n🔀  [Merge Agent] ready to commit.\n');

  let approved = autoMerge;
  if (!autoMerge) {
    const ans = await ask(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `  Files changed: ${changedFiles.join(', ')}\n` +
      `  Target branch: main\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `  Approve merge? (yes / no): `
    );
    approved = ['yes', 'y', 'approve', 'merge', 'merge it'].includes(ans.toLowerCase());
  }

  if (!approved) {
    console.log('\n🚫  Merge cancelled. Changes saved locally.');
    return null;
  }

  const msg = `style: ${task}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`;
  run(`git add ${changedFiles.join(' ')}`, ROOT);
  const commit = run(`git commit -m "${msg.replace(/"/g, "'")}"`, ROOT);
  if (!commit.ok) { console.error('Commit failed:\n', commit.output); return null; }

  const push = run('git push origin main', ROOT);
  if (push.ok) {
    const url = 'https://github.com/madhukar6143/todo_with_agent';
    console.log(`\n✅  Pushed! View at: ${url}`);
    return url;
  } else {
    console.error('\n❌  Push failed:\n', push.output);
    return null;
  }
}

// ── MAIN export ──────────────────────────────────────────────────────────────

export async function runDevLoop(task, autoMerge = false) {
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`🚀  Dev Loop started`);
  console.log(`📝  Task: "${task}"`);
  console.log(`${'━'.repeat(50)}`);

  const changedFiles        = await uiAgent(task);
  const { passed, report }  = await qaAgent(changedFiles);

  if (!passed) {
    console.log('\n❌  QA failed — merge blocked. Fix errors and retry.');
    return { success: false, report };
  }

  const url = await mergeAgent(task, changedFiles, autoMerge);
  return { success: !!url, url, report };
}

// ── Email task extractor (used by server.js) ─────────────────────────────────

export function parseEmailToTask(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();

  // Common bug-report keywords → map to actionable tasks
  const patterns = [
    { match: /font|color|colour|text.*color/,   task: `Fix UI issue: ${subject}` },
    { match: /button|click|submit/,              task: `Fix button issue: ${subject}` },
    { match: /broken|not working|error|crash/,  task: `Investigate and fix: ${subject}` },
    { match: /slow|performance|loading/,         task: `Improve performance: ${subject}` },
    { match: /mobile|responsive|layout/,         task: `Fix responsive layout: ${subject}` },
  ];

  for (const { match, task } of patterns) {
    if (match.test(text)) return task;
  }

  // Fall back to using the subject line directly if it's meaningful
  if (subject && subject.length > 5) return subject;
  return null;
}
