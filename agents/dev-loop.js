/**
 * Agentic Dev Loop
 *
 * Usage:
 *   node agents/dev-loop.js "change heading font color to red"
 *
 * Flow:
 *   1. UI Agent  → reads the request, edits the relevant source files
 *   2. QA Agent  → runs both test suites, reports results
 *   3. You       → approve or reject the merge
 *   4. Git       → commits + pushes if approved
 */

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const client = new Anthropic();
const ROOT = path.resolve(import.meta.dirname, '..');

// ─── helpers ───────────────────────────────────────────────────────────────

function readFile(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
}

function writeFile(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
}

function run(cmd, cwd = ROOT) {
  try {
    return { ok: true, output: execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, output: e.stdout + '\n' + e.stderr };
  }
}

async function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function callClaude(system, userMsg) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: userMsg }],
  });
  return res.content[0].text;
}

// ─── source snapshot for context ───────────────────────────────────────────

function getSourceSnapshot() {
  const files = [
    'frontend/src/App.jsx',
    'frontend/src/index.css',
    'frontend/src/components/AddTodo.jsx',
    'frontend/src/components/TodoItem.jsx',
    'frontend/src/components/FilterBar.jsx',
    'frontend/src/components/TodoList.jsx',
  ];
  return files
    .map((f) => `### ${f}\n\`\`\`\n${readFile(f) ?? '(not found)'}\n\`\`\``)
    .join('\n\n');
}

// ─── AGENT 1: UI ────────────────────────────────────────────────────────────

async function uiAgent(request) {
  console.log('\n🎨  UI Agent running...');

  const snapshot = getSourceSnapshot();
  const response = await callClaude(
    `You are a frontend UI engineer working on a React + Tailwind CSS todo app.
Your ONLY job is to edit the source files to implement the requested UI change.
Respond with a JSON array of file edits. Each edit has:
  { "file": "relative/path", "content": "full new file content" }
Only include files you actually need to change. Do not explain — just output valid JSON.`,
    `Current source files:\n\n${snapshot}\n\n---\nUI change request: ${request}`
  );

  let edits;
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    edits = JSON.parse(jsonMatch[0]);
  } catch {
    console.error('UI Agent returned unexpected format:\n', response);
    process.exit(1);
  }

  for (const { file, content } of edits) {
    writeFile(file, content);
    console.log(`  ✏️  Updated: ${file}`);
  }

  return edits.map((e) => e.file);
}

// ─── AGENT 2: QA ────────────────────────────────────────────────────────────

async function qaAgent(changedFiles) {
  console.log('\n🧪  QA Agent running tests...\n');

  const fe = run('npm test -- --reporter=verbose', path.join(ROOT, 'frontend'));
  const be = run('npm test', path.join(ROOT, 'backend'));

  const feStatus = fe.ok ? '✅ PASS' : '❌ FAIL';
  const beStatus = be.ok ? '✅ PASS' : '❌ FAIL';

  console.log(`  Frontend tests: ${feStatus}`);
  console.log(`  Backend tests:  ${beStatus}`);

  const summary = await callClaude(
    'You are a QA engineer. Write a concise 3-5 line QA report based on the test output provided.',
    `Changed files: ${changedFiles.join(', ')}\n\nFrontend test output:\n${fe.output}\n\nBackend test output:\n${be.output}`
  );

  console.log('\n📋  QA Report:\n' + summary);
  return fe.ok && be.ok;
}

// ─── AGENT 3: MERGE ─────────────────────────────────────────────────────────

async function mergeAgent(request, changedFiles) {
  console.log('\n🔀  Merge Agent ready.\n');

  const answer = await ask(
    `All tests passed. Shall I commit and push these changes?\n` +
    `  Files: ${changedFiles.join(', ')}\n` +
    `  Branch: main\n\n` +
    `  Type "yes" to merge, anything else to cancel: `
  );

  if (!['yes', 'y', 'approve', 'merge', 'merge it'].includes(answer.toLowerCase())) {
    console.log('\n🚫  Merge cancelled. Changes are saved locally but not pushed.');
    return;
  }

  const commitMsg = `style: ${request}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`;
  run(`git add ${changedFiles.join(' ')}`, ROOT);
  run(`git commit -m "${commitMsg.replace(/"/g, "'")}"`, ROOT);
  const push = run('git push origin main', ROOT);

  if (push.ok) {
    console.log('\n✅  Pushed to main! View at: https://github.com/madhukar6143/todo_with_agent');
  } else {
    console.error('\n❌  Push failed:\n', push.output);
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

const request = process.argv.slice(2).join(' ');
if (!request) {
  console.error('Usage: node agents/dev-loop.js "<your UI request>"');
  process.exit(1);
}

console.log(`\n🚀  Starting agentic dev loop`);
console.log(`📝  Request: "${request}"\n`);

const changedFiles = await uiAgent(request);
const allPassed    = await qaAgent(changedFiles);

if (!allPassed) {
  console.log('\n❌  QA failed. Merge blocked. Fix errors before retrying.');
  process.exit(1);
}

await mergeAgent(request, changedFiles);
