/**
 * Agent API Server — always-running HTTP server.
 *
 * Accepts commands from:
 *   • curl / any HTTP client
 *   • Email webhooks (Postmark, SendGrid, Mailgun)
 *   • GitHub Issues webhooks
 *   • Slack slash commands
 *   • Your own dashboard / mobile app
 *
 * Start:  node agents/server.js
 *
 * Quick test:
 *   curl -X POST http://localhost:4000/run \
 *        -H "Content-Type: application/json" \
 *        -d '{"task": "change font color to blue"}'
 */

import express from 'express';
import { runDevLoop, parseEmailToTask } from './runner.js';

const app  = express();
const PORT = process.env.AGENT_PORT || 4000;

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'todo-with-agent', time: new Date().toISOString() });
});

// ── Run any task ──────────────────────────────────────────────────────────────
// Body: { "task": "change font to blue", "autoMerge": false }
app.post('/run', async (req, res) => {
  const { task, autoMerge = false } = req.body;
  if (!task) return res.status(400).json({ error: '"task" is required' });

  console.log(`\n📨  Task via API: "${task}"`);
  // Respond immediately so the caller isn't blocked
  res.json({ status: 'accepted', task });

  runDevLoop(task, autoMerge).catch(console.error);
});

// ── Email webhook ─────────────────────────────────────────────────────────────
// Point your email provider (Postmark / SendGrid / Mailgun) inbound webhook here:
//   http://your-server:4000/email-webhook
app.post('/email-webhook', async (req, res) => {
  const b = req.body;
  const subject = b.Subject  || b.subject  || b.headers?.Subject || '';
  const text    = b.TextBody || b.text     || b.body_plain       || '';
  const from    = b.From     || b.from     || b.sender           || 'unknown';

  console.log(`\n📧  Email from ${from} — "${subject}"`);

  const task = parseEmailToTask(subject, text);
  if (!task) {
    console.log('    ⚠️  No actionable task found — skipping');
    return res.json({ status: 'skipped', reason: 'no actionable task found' });
  }

  console.log(`    🎯  Task: "${task}"`);
  res.json({ status: 'accepted', task });
  runDevLoop(task, false).catch(console.error);
});

// ── GitHub Issues webhook ─────────────────────────────────────────────────────
// GitHub repo → Settings → Webhooks → URL: http://your-server:4000/github-webhook
// Content type: application/json  |  Events: Issues
app.post('/github-webhook', async (req, res) => {
  const { action, issue } = req.body;
  if (action !== 'opened') return res.json({ status: 'ignored' });

  const labels = (issue?.labels || []).map(l => l.name);
  if (!labels.includes('agent-task') && !labels.includes('bug')) {
    return res.json({ status: 'ignored', reason: 'needs label: agent-task or bug' });
  }

  const task = `${issue.title}. ${(issue.body || '').slice(0, 200)}`;
  console.log(`\n🐙  GitHub Issue #${issue.number}: "${issue.title}"`);
  res.json({ status: 'accepted', task });
  runDevLoop(task, false).catch(console.error);
});

// ── Slack slash command ────────────────────────────────────────────────────────
// In Slack app settings → Slash Commands → Request URL: http://your-server:4000/slack
// Command: /agent    Usage: /agent change font to blue
app.post('/slack', async (req, res) => {
  const { text, user_name } = req.body;
  if (!text) return res.json({ text: 'Usage: /agent <task description>' });

  console.log(`\n💬  Slack from @${user_name}: "${text}"`);
  res.json({ text: `✅ Agent started on: "${text}"\nCheck server logs for progress.` });
  runDevLoop(text, false).catch(console.error);
});

app.listen(PORT, () => {
  console.log(`
🤖  Agent Server running on http://localhost:${PORT}

  Endpoints:
    GET  /health
    POST /run             ← { "task": "..." }  from curl / any app
    POST /email-webhook   ← Postmark / SendGrid / Mailgun inbound
    POST /github-webhook  ← GitHub Issues (labeled "bug" or "agent-task")
    POST /slack           ← Slack slash command /agent

  Quick test (open a new terminal):
    curl -X POST http://localhost:${PORT}/run \\
         -H "Content-Type: application/json" \\
         -d '{"task":"change font color to blue"}'
`);
});
