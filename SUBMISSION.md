# Pathway - Devpost submission texts for the Relate by Neo4j Hackathon

Copy each block into the matching Devpost field.

## Project name

Pathway

## Tagline

See the shortest route to any course. Pathway maps courses, prerequisites, topics and lecturers as a graph in Relate, so students stop guessing what to take next.

## Team

Ibrahim Yahaya (solo), student at the Federal University of Technology Minna, Nigeria.

## The problem

Course registration is a graph problem that students solve with PDFs and guesswork. A course catalogue is a flat list, but the real structure is connected: Machine Learning needs Artificial Intelligence, which needs Algorithms and Probability, which need Data Structures, which needs Programming II, all the way down to 100 level. Students discover missing prerequisites at registration, carry over courses they never knew were blocking them, and cannot answer simple questions like "what can I take next semester?" or "what does this course unlock?" without asking a senior or an adviser.

## The solution

Pathway turns the course catalogue into a graph and answers those questions by traversal.

- Courses, topics and lecturers are nodes. Prerequisites, topic coverage and teaching are relationships.
- Click any course to see its direct prerequisites, everything needed before it (found by traversing REQUIRES edges), the shortest chain down to a foundation course (Cypher shortestPath), what it unlocks, its topics and its lecturer.
- The Path finder takes a target course, asks Relate for every course reachable through prerequisite edges, and orders them into a valid study sequence.
- Students mark courses as completed; the progress bar, per-level counts and "Ready to take next" list update from the graph. Completions are stored as a property on the course node, inside the graph itself.
- Students can add their own courses with prerequisites. The write goes into the same Relate store, so every path answer updates immediately and survives a reload.

The sample data is a computer science programme in the style of my university, FUTMINNA: 33 courses, 43 prerequisite links, 30 topics, 8 lecturers. Lecturer names are fictional sample names.

## How it uses Relate

Relate is the database, not a decoration. The app runs the Relate WebAssembly engine (`@relate/relate-wasm` 1.3.0) in a Web Worker and opens a persistent store with `RelateDb.open('opfs://pathway')`, so the graph lives in the browser's OPFS and survives reloads with no server and no account. Every screen is driven by Cypher: shortestPath for the signature chain query, variable length traversals for the full prerequisite set, and plain CREATE, SET and DETACH DELETE for writes. All statements are in one file, `src/cypher.js`, and the app footer shows the most recent statement and its engine time.

The repo also ships an inspectable single-file store, `data/pathway.rl`, written by a seed script using the Relate Node client (`@relate/relate` 1.3.0) from the exact same seed script the browser runs. Judges can open it with the relate CLI and run the same queries.

Mode chosen: single file. In the browser that is the OPFS store, which is Relate's browser equivalent of a single-file store; in the repo it is `data/pathway.rl`. I chose it because Pathway is a static site: one file per student, no server to deploy, and the whole graph travels with the repo for inspection.

## Technologies

- Relate by Neo4j (`@relate/relate-wasm` 1.3.0 in the browser, `@relate/relate` 1.3.0 in Node for the seed script), Cypher 25
- React and Vite for the app
- Plain CSS written from scratch: blueprint graph paper, ink navy with amber and teal accents, Archivo headings, Public Sans body, IBM Plex Mono for course codes, all self-hosted so it works offline
- SVG graph canvas with a layered layout computed in pure functions
- Core logic (layout, study ordering, validation, progress) as pure functions with 16 unit tests, plus 19 Playwright end to end checks against the production build, zero console errors

## Challenges

Two things took real care. First, the shortestPath edge case: when the target course is itself a foundation course, Relate rejects a plain `*` pattern because start and end are the same node. The fix was `[:REQUIRES*0..12]`, which returns the single course as its own chain. Second, serving the engine: the WASM glue fetches `relate_bg.wasm` from beside itself, so the engine files must be served as static files, unchanged, outside the bundle. A small copy script runs on install, and the worker resolves the files relative to its own script so the app also works under a subpath like a GitHub Pages project site.

## What I learned

Connected questions deserve connected data. "What must I pass before CPT401?" is one traversal in Cypher and a mess of nested loops over JSON. Keeping the graph in Relate meant the answers are always computed from the current graph: add a course, and every path, unlock list and progress count is correct on the next click, with no cache to invalidate.

## Future improvements

- Import a real departmental course list from CSV with LOAD CSV
- Semester planner that respects unit limits per semester
- Share a study path as a link, and export it as a printable checklist
- Pull a live subgraph from a Neo4j server over Bolt for departments that publish one
- Graph view filtering by topic and lecturer, with the same traversals

## Links

- Live demo: [add the deployed link here]
- Demo video: [add the YouTube link here]
- Source code: [add the GitHub repo link here]
- Screenshots: in the docs folder of the repo (graph, course detail, path finder, progress, add course, mobile)

## Setup steps

```bash
npm install
npm run dev
```

Open the local address Vite prints. The sample graph seeds itself on first load. Inspect the shipped store with `npm run seed` to rebuild it, or query `data/pathway.rl` directly with the relate CLI.

## Credits and acknowledgements

- Relate by Neo4j (Neo4j Labs, Apache-2.0): https://relatedb.ai and https://github.com/relatedb/relate
- React and Vite (open source)
- Archivo, Public Sans and IBM Plex Mono fonts from Google Fonts (OFL licence), self-hosted in the repo
- The sample course graph is modelled on a typical Nigerian federal university computer science programme. Lecturer names are fictional. No real student data is used anywhere.
- All work on this project was done during the Relate by Neo4j Hackathon period (11 Nov to 11 Dec 2026).
