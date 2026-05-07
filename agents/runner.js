/**
 * Shared agent runner — UI Agent → QA Agent → Merge Agent
 * Emits both plain log lines AND rich inspect events for the dashboard.
 */

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { emit, inspect } from './logger.js';

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

function readlineApproval() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n  Approve merge? (yes / no): ', (ans) => {
      rl.close();
      resolve(['yes', 'y', 'approve', 'merge'].includes(ans.trim().toLowerCase()));
    });
  });
}

async function claude(agent, title, systemPrompt, userMsg) {
  // Show what we're sending
  inspect({
    agent,
    phase: 'request',
    title: `📤 ${title} — Prompt`,
    content: `SYSTEM:\n${systemPrompt}\n\n${'─'.repeat(60)}\nUSER:\n${userMsg}`,
  });

  const t0  = Date.now();
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });
  const ms     = Date.now() - t0;
  const tokens = res.usage.input_tokens + res.usage.output_tokens;
  const reply  = res.content[0].text;

  // Show what Claude replied
  inspect({
    agent,
    phase: 'response',
    title: `📥 ${title} — Response`,
    content: reply,
    meta: { tokens, ms, model: res.model },
  });

  return reply;
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

// simple line-level diff
function diffText(before, after, file) {
  const a = (before || '').split('\n');
  const b = (after  || '').split('\n');
  const lines = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) lines.push(`- ${a[i]}`);
    if (b[i] !== undefined) lines.push(`+ ${b[i]}`);
  }
  return lines.length ? lines.join('\n') : '(no textual diff)';
}

// ── AGENT 1: UI ──────────────────────────────────────────────────────────────

async function uiAgent(task) {
  emit('🎨  [UI Agent] Reading source files…', 'ui');
  const snapshot = sourceSnapshot();

  const systemPrompt =
    `You are a frontend UI engineer for a React + Tailwind CSS todo app.
Your ONLY job: implement the UI change by editing source files.
Respond with a JSON array of edits: [{ "file": "relative/path", "content": "full file content" }]
Only include files that actually need to change. Output valid JSON only — no explanation.`;

  const userMsg = `Current source:\n\n${snapshot}\n\n---\nTask: ${task}`;

  const response = await claude('UI Agent', 'Code Edit', systemPrompt, userMsg);

  let edits;
  try {
    edits = JSON.parse(response.match(/\[[\s\S]*\]/)[0]);
  } catch {
    throw new Error('UI Agent returned invalid JSON:\n' + response);
  }

  emit(`🎨  [UI Agent] Applying ${edits.length} file edit(s)…`, 'ui');

  for (const { file, content } of edits) {
    const before = readFile(file);
    writeFile(file, content);
    emit(`  ✏️   Edited: ${file}`, 'file');

    inspect({
      agent: 'UI Agent',
      phase: 'diff',
      title: `🔀 Diff — ${file}`,
      content: diffText(before, content, file),
    });
  }

  emit('🎨  [UI Agent] Done.', 'ui');
  return edits.map((e) => e.file);
}

// ── AGENT 2: QA ──────────────────────────────────────────────────────────────

async function qaAgent(changedFiles) {
  emit('🧪  [QA Agent] Running frontend tests (Vitest)…', 'qa');
  const fe = run('npm test', path.join(ROOT, 'frontend'));
  emit(`  Frontend: ${fe.ok ? '✅ PASS' : '❌ FAIL'}`, fe.ok ? 'success' : 'error');

  inspect({
    agent: 'QA Agent',
    phase: 'test',
    title: `🧪 Frontend Tests — ${fe.ok ? '✅ PASS' : '❌ FAIL'}`,
    content: fe.output.trim(),
  });

  emit('🧪  [QA Agent] Running backend tests (Jest)…', 'qa');
  const be = run('npm test', path.join(ROOT, 'backend'));
  emit(`  Backend:  ${be.ok ? '✅ PASS' : '❌ FAIL'}`, be.ok ? 'success' : 'error');

  inspect({
    agent: 'QA Agent',
    phase: 'test',
    title: `🧪 Backend Tests — ${be.ok ? '✅ PASS' : '❌ FAIL'}`,
    content: be.output.trim(),
  });

  emit('🧪  [QA Agent] Generating QA report…', 'qa');

  const systemPrompt = 'You are a QA engineer. Write a concise 3–5 line QA report based on the test output.';
  const userMsg = `Changed: ${changedFiles.join(', ')}\n\nFrontend:\n${fe.output}\n\nBackend:\n${be.output}`;
  const report = await claude('QA Agent', 'QA Report', systemPrompt, userMsg);

  emit('📋  QA Report:', 'qa');
  report.split('\n').filter(Boolean).forEach(line => emit(`  ${line}`, 'qa'));

  return { passed: fe.ok && be.ok, report };
}

// ── AGENT 3: MERGE ───────────────────────────────────────────────────────────

async function mergeAgent(task, changedFiles, autoMerge, approvalFn) {
  emit('🔀  [Merge Agent] All tests passed.', 'merge');

  let approved = autoMerge;
  if (!autoMerge) {
    emit(`    Files changed: ${changedFiles.join(', ')}`, 'merge');
    emit(`APPROVAL_REQUIRED`, 'prompt');
    approved = await approvalFn();
  }

  if (!approved) {
    emit('🚫  Merge cancelled. Changes saved locally.', 'merge');
    return null;
  }

  emit('🔀  [Merge Agent] Committing and pushing…', 'merge');

  run(`git add ${changedFiles.join(' ')}`, ROOT);
  const diff = run('git diff --cached --quiet', ROOT);
  if (diff.ok) {
    emit('⚠️  No file changes detected — nothing to commit.', 'merge');
    return null;
  }

  const msg = `style: ${task}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`;
  const commit = run(`git commit -m "${msg.replace(/"/g, "'")}"`, ROOT);
  if (!commit.ok) {
    emit('❌  Commit failed: ' + commit.output, 'error');
    return null;
  }

  inspect({
    agent: 'Merge Agent',
    phase: 'response',
    title: '📦 Git Commit',
    content: commit.output.trim(),
  });

  const push = run('git push origin main', ROOT);
  if (push.ok) {
    const url = 'https://github.com/madhukar6143/todo_with_agent';
    emit(`✅  Pushed! View at: ${url}`, 'success');
    return url;
  } else {
    emit('❌  Push failed: ' + push.output, 'error');
    return null;
  }
}

// ── MAIN export ──────────────────────────────────────────────────────────────

export async function runDevLoop(task, autoMerge = false, approvalFn = readlineApproval) {
  emit('━'.repeat(50), 'start');
  emit(`🚀  Dev Loop started`, 'start');
  emit(`📝  Task: "${task}"`, 'start');
  emit('━'.repeat(50), 'start');

  try {
    const changedFiles       = await uiAgent(task);
    const { passed, report } = await qaAgent(changedFiles);

    if (!passed) {
      emit('❌  QA failed — merge blocked. Fix errors and retry.', 'error');
      return { success: false, report };
    }

    const url = await mergeAgent(task, changedFiles, autoMerge, approvalFn);
    return { success: !!url, url, report };
  } catch (err) {
    emit(`❌  Agent error: ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

// ── Email task parser ─────────────────────────────────────────────────────────

export function parseEmailToTask(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  const patterns = [
    { match: /font|color|colour|text.*color/, task: `Fix UI issue: ${subject}` },
    { match: /button|click|submit/,           task: `Fix button issue: ${subject}` },
    { match: /broken|not working|error|crash/,task: `Investigate and fix: ${subject}` },
    { match: /slow|performance|loading/,      task: `Improve performance: ${subject}` },
    { match: /mobile|responsive|layout/,      task: `Fix responsive layout: ${subject}` },
  ];
  for (const { match, task } of patterns) {
    if (match.test(text)) return task;
  }
  return subject?.length > 5 ? subject : null;
}
