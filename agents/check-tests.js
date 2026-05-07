/**
 * Hook: runs automatically after every file edit.
 * Prints a quick pass/fail — does not block the agent.
 */
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const fePassed = run('npm test', path.join(ROOT, 'frontend'));
console.log(fePassed ? '✅ Frontend tests pass' : '❌ Frontend tests FAILED');
