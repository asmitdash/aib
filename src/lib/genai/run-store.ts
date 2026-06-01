import "server-only";

import type { Blueprint } from "./schemas/blueprint";
import type { QuestionSet } from "./schemas/questions";

export interface RunState {
  spec: string;
  blueprint: Blueprint;
  questions: QuestionSet;
  specHash: string;
  createdAt: number;
}

// Module-level Map; in-memory is fine for V1 single-user use.
// On Vercel each Lambda has its own scope — first-call+answers must hit the
// same warm container. For V1 (Asmit testing alone) the request affinity is
// effectively guaranteed, but if it ever misses, the answers route falls back
// to re-parsing via the rawSpec.
const _runs = new Map<string, RunState>();

const TTL_MS = 30 * 60_000;

export function putRun(runId: string, state: RunState): void {
  _runs.set(runId, state);
  // Opportunistic GC.
  if (_runs.size > 64) {
    const cutoff = Date.now() - TTL_MS;
    for (const [k, v] of _runs) {
      if (v.createdAt < cutoff) _runs.delete(k);
    }
  }
}

export function getRun(runId: string): RunState | undefined {
  return _runs.get(runId);
}

export function deleteRun(runId: string): void {
  _runs.delete(runId);
}
