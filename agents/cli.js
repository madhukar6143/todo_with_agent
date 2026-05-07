#!/usr/bin/env node
/**
 * CLI runner — run from ANY terminal, anywhere, without opening Claude.
 *
 * Usage:
 *   node agents/cli.js "change font color to blue"
 *   node agents/cli.js "fix the broken delete button on mobile"
 *   node agents/cli.js "make the header background dark" --auto-merge
 *
 * Flags:
 *   --auto-merge   Skip the human approval prompt and push automatically
 */

import { runDevLoop } from './runner.js';

const args      = process.argv.slice(2);
const autoMerge = args.includes('--auto-merge');
const task      = args.filter(a => !a.startsWith('--')).join(' ');

if (!task) {
  console.error(`
Usage: node agents/cli.js "<task>" [--auto-merge]

Examples:
  node agents/cli.js "change font color to blue"
  node agents/cli.js "make buttons rounded" --auto-merge
  node agents/cli.js "fix layout on mobile screens"
`);
  process.exit(1);
}

const result = await runDevLoop(task, autoMerge);
process.exit(result.success ? 0 : 1);
