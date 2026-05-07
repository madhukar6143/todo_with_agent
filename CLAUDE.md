# Todo App — Agent Rulebook

## Project Structure
- `frontend/` — React + Vite + Tailwind CSS (dev port 5173)
- `backend/`  — Node.js + Express + SQLite (dev port 3001)
- `agents/`   — Agent orchestration scripts

## Stack Quick Reference
| Layer     | Tech                          | Test command              |
|-----------|-------------------------------|---------------------------|
| Frontend  | React 18, Vite, Tailwind CSS  | `cd frontend && npm test` |
| Backend   | Express, better-sqlite3       | `cd backend && npm test`  |

---

## Agent Roles & Responsibilities

### UI Agent
- Scope: `frontend/src/**`
- Allowed actions: edit `.jsx`, `.js`, `.css` files
- Must run `cd frontend && npm test` after every change
- Must take a browser screenshot to confirm the visual change looks correct
- Never touches backend code

### QA Agent
- Runs both test suites: frontend (Vitest) and backend (Jest + Supertest)
- Reports: total tests, pass/fail count, any error output
- Takes a visual browser screenshot and describes what it sees
- Passes only when ALL tests are green

### Merge Agent
- Stages changed files, writes a clear commit message describing WHAT changed and WHY
- Opens a PR (never pushes directly to main)
- **ALWAYS pauses and asks the human for approval before creating the PR**
- Only proceeds after an explicit "yes" / "approve" / "merge it" from the human

---

## Golden Rules (all agents must follow)
1. Never merge to `main` without explicit human approval
2. Never skip the test suite before marking a task complete
3. If tests fail, fix the code — do not disable or delete tests
4. Keep changes minimal — only touch what the task requires
5. After a UI change, always verify visually in the browser preview

---

## How to Request Work
Speak to Claude in plain English. Examples:

| You say | What happens |
|---|---|
| "Change heading font to red" | UI Agent edits Tailwind classes → QA Agent tests → Merge Agent asks you |
| "Add a priority field to todos" | UI + Backend agents coordinate → QA validates → Merge Agent asks you |
| "Run the full test suite" | QA Agent runs both suites and reports results |
| "Show me a screenshot of the app" | Preview agent takes a browser screenshot |

---

## Commit Message Format
```
<type>: <short description>

<what changed and why>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Types: `feat`, `fix`, `style`, `test`, `refactor`
