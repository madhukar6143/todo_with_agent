/**
 * Browser-based approval gate.
 * When the Merge Agent needs a decision, it calls waitForApproval().
 * The server exposes POST /approve and POST /reject.
 * The dashboard shows Approve / Reject buttons when a decision is pending.
 */

let _resolve = null;

/** Called by the Merge Agent — blocks until the user clicks Approve or Reject. */
export function waitForApproval() {
  return new Promise((resolve) => {
    _resolve = resolve;
  });
}

/** Called by POST /approve */
export function approve() {
  if (_resolve) { _resolve(true);  _resolve = null; }
}

/** Called by POST /reject */
export function reject() {
  if (_resolve) { _resolve(false); _resolve = null; }
}

/** True when a decision is currently being waited on. */
export function isPending() {
  return _resolve !== null;
}
