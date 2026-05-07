/**
 * Shared logger — writes to terminal AND streams to dashboard via SSE.
 * Supports two event types:
 *   'log'     — a plain text line shown in the log panel
 *   'inspect' — rich structured data shown in the Agent Inspector panel
 */

const clients = new Set();

export function addSseClient(res) {
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

export function emit(msg, type = 'info') {
  broadcast('log', { msg, type });

  const colours = {
    start: '\x1b[35m', ui: '\x1b[34m', qa: '\x1b[32m',
    merge: '\x1b[33m', success: '\x1b[32m', error: '\x1b[31m',
    file: '\x1b[36m', prompt: '\x1b[33m', info: '\x1b[90m',
  };
  console.log(`${colours[type] ?? ''}${msg}\x1b[0m`);
}

/**
 * Emit a rich inspection event shown in the Agent Inspector panel.
 * @param {object} data
 *   agent      - 'UI Agent' | 'QA Agent' | 'Merge Agent'
 *   phase      - 'request' | 'response' | 'diff' | 'test'
 *   title      - short label shown as the accordion header
 *   content    - string body (prompt text, response text, diff, test output)
 *   meta       - optional { tokens, ms, model }
 */
export function inspect(data) {
  broadcast('inspect', data);
}
