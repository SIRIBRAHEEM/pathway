# Pathway

See the shortest route to any course: Pathway maps university courses, prerequisites, topics and lecturers as a graph, so a student can answer "what must I pass before Machine Learning?" in one click.

## Use case

Course registration is a graph problem that students currently solve by reading PDFs and asking seniors. A course catalogue hides the structure: CPT401 Machine Learning needs CPT307, which needs CPT205 and STA201, which need CPT201, and so on down to 100 level. Pathway makes that structure visible and queryable:

- **Course** nodes (code, title, level, semester, units, summary, completed flag)
- **Topic** nodes (what a course covers)
- **Lecturer** nodes (who teaches it)
- `REQUIRES` edges (course to prerequisite), `COVERS` edges (course to topic), `TEACHES` edges (lecturer to course)

With that graph, Pathway answers real student questions by traversal, not by scanning a list:

- What is the shortest chain from this course down to a foundation course? (`shortestPath`)
- What is everything I need before this course? (variable length traversal)
- What does this course unlock? (reverse traversal)
- What can I take next semester? (prerequisites all completed)
- Give me a valid study order for this target. (topological order over the traversed set)

The sample data is a computer science programme in the style of the Federal University of Technology Minna (33 courses, 43 prerequisite links, 30 topics, 8 lecturers). Lecturer names are fictional sample names, and the app says so on screen.

## How it uses Relate

- **Mode: single file in the browser (OPFS), plus a single-file store in this repo.**
- **Why this mode:** Pathway is a static web app with no server. Relate's WebAssembly build runs the full Cypher engine inside a Web Worker in the tab, and `RelateDb.open('opfs://pathway')` persists the graph in the browser's Origin Private File System, so completions and courses a student adds survive reloads with no backend and no account. If OPFS is unavailable the app falls back to an in-memory store for that session and says so in the "Under the hood" panel.
- **Packages:** `@relate/relate-wasm` 1.3.0 in the browser (engine served as static files from `public/relate/`, copied there by `scripts/copy-relate.mjs` on install), and `@relate/relate` 1.3.0 (Node client) for the seed script that writes the inspectable store.
- **What the graph models:** courses, topics and lecturers as nodes; prerequisites, coverage and teaching as relationships. Every screen is driven by Cypher against the embedded engine. All statements live in `src/cypher.js`, and the app footer shows the most recent statement and its engine time so anyone can see Relate actually running.
- **Signature queries:**
  - Shortest prerequisite chain: `shortestPath((target)-[:REQUIRES*0..12]->(foundation))` where a foundation is a course with no `REQUIRES` edge. The `0` lower bound matters: when the target is itself a foundation course, the chain is just that course.
  - Full prerequisite set: `(target)-[:REQUIRES*1..12]->(pre)` collected distinctly.
  - Writes are plain Cypher too: `SET c.completed = $completed`, `CREATE (:Course {...})`, `CREATE (a)-[:REQUIRES]->(b)`, `DETACH DELETE`.
- **Why Relate and not a JSON file:** the questions Pathway answers are traversals. In Relate they are one Cypher statement each, executed in process with no network calls, and the same store can be opened by the relate CLI, the Node client, or `relate serve` over Bolt, HTTP or MCP if the project grows. The graph also stays honest: add a course with a prerequisite and every path answer updates immediately, because the answers come from the graph, not from cached lists.

## Setup and run

Prerequisites: Node.js 18 or later (developed on Node 24), and a browser with WebAssembly module workers and OPFS (recent Chrome or Edge).

```bash
npm install
npm run dev
```

Open the local address Vite prints. The sample graph seeds itself on first load. To run the production build:

```bash
npm run build
npm run preview
```

Checks:

```bash
npm test          # 16 unit tests for the pure logic in src/logic.js
npm run lint      # oxlint, zero warnings
node scripts/e2e.mjs   # 19 Playwright checks against the production build
```

Rebuild the inspectable store in `data/`:

```bash
npm run seed
```

## Where the data lives

- **In the browser:** the OPFS store `opfs://pathway`, owned by the Web Worker in `src/worker.js`. Delete it any time with the "Reset sample graph" button, which wipes and reseeds.
- **In this repo:** `data/pathway.rl`, a single-file Relate store written by `scripts/seed-store.mjs` with the Node client, from the exact same seed script the browser runs (`src/seedScript.js`). Inspect it with any Relate client, for example the CLI:

```bash
relate --database data/pathway.rl "MATCH (c:Course) RETURN count(c) AS courses"
relate --database data/pathway.rl "MATCH p = shortestPath((t:Course {code:'CPT401'})-[:REQUIRES*0..12]->(f:Course {code:'CPT101'})) RETURN [n IN nodes(p) | n.code] AS chain"
```

## GitHub topic tag (required by the hackathon)

This repository must carry the GitHub topic **relate** so the organisers can find and verify the entry. Add it under About, Topics, and also add **relate-neo4j-hackathon** (recommended). The repo must be public.

## Project layout

- `src/App.jsx` - the interface (graph canvas, detail panel, path finder, add course)
- `src/logic.js` - pure functions: layout, study ordering, validation, progress (unit tested)
- `src/cypher.js` - every Cypher statement the app runs
- `src/worker.js` - the Web Worker that owns the Relate store
- `src/relateClient.js` - page side bridge to the worker
- `src/seedData.js`, `src/seedScript.js` - the sample graph and its Cypher seed script
- `scripts/seed-store.mjs` - writes `data/pathway.rl` with the Node client
- `scripts/copy-relate.mjs` - copies the WASM engine into `public/relate/` on install
- `scripts/e2e.mjs`, `scripts/screenshots.mjs` - browser checks and doc screenshots
- `tests/logic.test.mjs` - unit tests (node:test)
- `docs/` - screenshots

## Notes

- Works offline after first load: fonts are self-hosted, the engine is a static file, the data is in OPFS.
- No account, no server, no tracking. A student's progress never leaves their browser.
