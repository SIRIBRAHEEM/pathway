// Pathway database worker.
//
// This dedicated module worker owns the Relate graph database.
// It opens a persistent store in OPFS (opfs://pathway) so the graph
// survives page reloads, seeds the sample course graph the first time,
// and answers Cypher statements sent by the page.
//
// Protocol: page sends { id, kind, statement, params }
//   kind "query"  -> one statement, replies { id, envelope }
//   kind "script" -> a multi-statement script, replies { id, envelopes }
//   kind "reset"  -> wipe the store and reseed, replies { id, envelope }
// On any thrown failure it replies { id, failed, trap }.

import { buildSeedScript } from './seedScript.js';

// The engine files are served as static files next to the app (public/relate).
// Resolve them relative to this worker script so the app also works when it
// is hosted under a subpath, for example a GitHub Pages project site.
const engineFile = (file) => new URL(`../relate/${file}`, self.location.href).href;

let isWasmTrap = () => false;
let storeMode = 'opfs';

const ready = (async () => {
  const relate = await import(/* @vite-ignore */ engineFile('relate.js'));
  await relate.default();
  try {
    const trap = await import(/* @vite-ignore */ engineFile('trap.js'));
    if (typeof trap.isWasmTrap === 'function') isWasmTrap = trap.isWasmTrap;
  } catch {
    // trap.js is a diagnostic helper only; the database works without it.
  }
  let db;
  try {
    db = await relate.RelateDb.open('opfs://pathway');
  } catch {
    // OPFS unavailable (older browser or blocked storage): fall back to
    // an in-memory store so the app still works for this session.
    db = new relate.RelateDb();
    storeMode = 'memory';
  }
  const count = JSON.parse(db.execute('MATCH (c:Course) RETURN count(c) AS n', null));
  if (!count.error && (count.rows[0]?.n ?? 0) === 0) {
    db.executeScript(buildSeedScript(), null);
  }
  return db;
})();

self.onmessage = async (event) => {
  const { id, kind, statement, params } = event.data;
  try {
    const db = await ready;
    if (kind === 'reset') {
      db.execute('MATCH (n) DETACH DELETE n', null);
      db.executeScript(buildSeedScript(), null);
      self.postMessage({ id, envelope: { rows: [{ reset: true }], storeMode } });
      return;
    }
    if (kind === 'script') {
      const texts = db.executeScript(statement, params ? JSON.stringify(params) : null);
      self.postMessage({ id, envelopes: texts.map((t) => JSON.parse(t)), storeMode });
      return;
    }
    const envelope = JSON.parse(db.execute(statement, params ? JSON.stringify(params) : null));
    self.postMessage({ id, envelope, storeMode });
  } catch (err) {
    self.postMessage({ id, failed: String(err && err.message ? err.message : err), trap: isWasmTrap(err) });
  }
};
