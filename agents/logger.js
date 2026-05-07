/**
 * Shared logger — writes to terminal AND streams to dashboard via SSE.
 */

const clients = new Set();

export function addSseClient(res) {
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

export function emit(msg, type = 'info') {
  const line = JSON.stringify({ msg, type });
  for (const res of clients) {
    res.write(`event: log\ndata: ${line}\n\n`);
  }

  // Terminal colours
  const colours = {
    start: '\x1b[35m', ui: '\x1b[34m', qa: '\x1b[32m',
    merge: '\x1b[33m', success: '\x1b[32m', error: '\x1b[31m',
    file: '\x1b[36m', prompt: '\x1b[33m', info: '\x1b[90m',
  };
  const reset = '\x1b[0m';
  console.log(`${colours[type] ?? ''}${msg}${reset}`);
}
