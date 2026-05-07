/**
 * Agent API Server with live dashboard.
 *
 * Start:  node agents/server.js
 * Then open:  http://localhost:4000
 *
 * Trigger a task:
 *   curl -X POST http://localhost:4000/run \
 *        -H "Content-Type: application/json" \
 *        -d '{"task": "change font color to green"}'
 */

import express from 'express';
import path from 'path';
import { readFileSync } from 'fs';
import { runDevLoop, parseEmailToTask } from './runner.js';
import { addSseClient, emit } from './logger.js';
import { approve, reject, isPending, waitForApproval } from './approval.js';

const app  = express();
const PORT = process.env.AGENT_PORT || 4000;
const DIR  = import.meta.dirname;

app.use(express.json());

// ── Dashboard ─────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(readFileSync(path.join(DIR, 'dashboard.html')));
});

// ── SSE: stream log events to dashboard ──────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`event: log\ndata: ${JSON.stringify({ msg: '🔌  Dashboard connected', type: 'success' })}\n\n`);
  addSseClient(res);
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Approval endpoints (called by dashboard buttons) ──────────────────────────
app.post('/approve', (_req, res) => {
  if (!isPending()) return res.status(409).json({ error: 'no approval pending' });
  emit('✅  Approved via dashboard — merging…', 'success');
  approve();
  res.json({ status: 'approved' });
});

app.post('/reject', (_req, res) => {
  if (!isPending()) return res.status(409).json({ error: 'no approval pending' });
  emit('🚫  Rejected via dashboard — merge cancelled.', 'merge');
  reject();
  res.json({ status: 'rejected' });
});

// ── Run any task ──────────────────────────────────────────────────────────────
app.post('/run', (req, res) => {
  const { task, autoMerge = false } = req.body;
  if (!task) return res.status(400).json({ error: '"task" is required' });
  res.json({ status: 'accepted', task });
  runDevLoop(task, autoMerge, waitForApproval).catch(e => emit('❌ ' + e.message, 'error'));
});

// ── Email webhook ─────────────────────────────────────────────────────────────
app.post('/email-webhook', (req, res) => {
  const b       = req.body;
  const subject = b.Subject  || b.subject  || '';
  const text    = b.TextBody || b.text     || '';
  const from    = b.From     || b.from     || 'unknown';

  emit(`📧  Email from ${from} — "${subject}"`, 'info');
  const task = parseEmailToTask(subject, text);
  if (!task) return res.json({ status: 'skipped' });

  emit(`  🎯  Task extracted: "${task}"`, 'ui');
  res.json({ status: 'accepted', task });
  runDevLoop(task, false, waitForApproval).catch(e => emit('❌ ' + e.message, 'error'));
});

// ── GitHub Issues webhook ─────────────────────────────────────────────────────
app.post('/github-webhook', (req, res) => {
  const { action, issue } = req.body;
  if (action !== 'opened') return res.json({ status: 'ignored' });

  const labels = (issue?.labels || []).map(l => l.name);
  if (!labels.includes('agent-task') && !labels.includes('bug'))
    return res.json({ status: 'ignored', reason: 'label "bug" or "agent-task" required' });

  const task = `${issue.title}. ${(issue.body || '').slice(0, 200)}`;
  emit(`🐙  GitHub Issue #${issue.number}: "${issue.title}"`, 'info');
  res.json({ status: 'accepted', task });
  runDevLoop(task, false, waitForApproval).catch(e => emit('❌ ' + e.message, 'error'));
});

// ── Slack slash command ───────────────────────────────────────────────────────
app.post('/slack', (req, res) => {
  const { text, user_name } = req.body;
  if (!text) return res.json({ text: 'Usage: /agent <task>' });
  emit(`💬  Slack from @${user_name}: "${text}"`, 'info');
  res.json({ text: `✅ Agent started on: "${text}"` });
  runDevLoop(text, false, waitForApproval).catch(e => emit('❌ ' + e.message, 'error'));
});

app.listen(PORT, () => {
  emit(`🤖  Agent server running — open dashboard: http://localhost:${PORT}`, 'success');
});
