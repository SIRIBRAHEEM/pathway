// Page-side bridge to the Relate worker.
// run() sends one Cypher statement and resolves with its result envelope.
// The last statement and its timing are kept so the UI can show judges
// exactly which Cypher ran against the embedded engine.

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

const pending = new Map();
let nextId = 0;

export const lastQuery = { statement: '', elapsedMs: null, storeMode: 'opfs' };

worker.onmessage = (event) => {
  const { id, envelope, envelopes, failed, trap, storeMode } = event.data;
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  if (storeMode) lastQuery.storeMode = storeMode;
  if (failed) {
    entry.reject(new Error(trap ? `Relate engine fault: ${failed}` : failed));
    return;
  }
  if (envelopes) {
    const bad = envelopes.find((e) => e.error);
    if (bad) entry.reject(new Error(bad.error));
    else entry.resolve(envelopes);
    return;
  }
  if (envelope && envelope.error) entry.reject(new Error(envelope.error));
  else entry.resolve(envelope);
};

function send(kind, statement, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, kind, statement, params });
  });
}

export async function run(statement, params) {
  const started = performance.now();
  const envelope = await send('query', statement, params);
  lastQuery.statement = statement.trim();
  lastQuery.elapsedMs =
    envelope && typeof envelope.elapsed_ms === 'number'
      ? envelope.elapsed_ms
      : Math.round(performance.now() - started);
  return envelope;
}

export async function runScript(script, params) {
  return send('script', script, params);
}

export async function resetGraph() {
  return send('reset', null, null);
}
