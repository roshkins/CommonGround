import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

// Operational metadata only. Never store prompts, briefs, tokens or transcripts.
export function createActivityTrace() {
  const context = new AsyncLocalStorage();
  const records = new Map();
  const allowed = new Set(['openai', 'relaycast', 'terse', 'supabase', 'twilio', 'freestyle', 'sfmta', 'push']);
  function record(service, operation, status, extra = {}) {
    const scope = context.getStore();
    if (!scope?.visitorId || !allowed.has(service)) return;
    const rows = records.get(scope.visitorId) || [];
    rows.push({ id: randomUUID(), at: new Date().toISOString(), service, operation, status,
      ...(Number.isFinite(extra.durationMs) ? { durationMs: Math.round(extra.durationMs) } : {}) });
    records.delete(scope.visitorId); records.set(scope.visitorId, rows.slice(-200));
    if (records.size > 500) records.delete(records.keys().next().value);
  }
  function start(service, operation) {
    const began = Date.now(); record(service, operation, 'started');
    return status => record(service, operation, status, { durationMs: Date.now() - began });
  }
  return {
    run: (scope, fn) => context.run(scope, fn), record, start,
    async track(service, operation, fn) {
      const finish = start(service, operation);
      try { const result = await fn(); finish(result?.ok === false ? 'failed' : 'succeeded'); return result; }
      catch (error) { finish('failed'); throw error; }
    },
    read: visitorId => structuredClone(records.get(visitorId) || []),
  };
}
