// Creates the persistent single-file Relate store that ships in this repo:
//   data/pathway.rl
//
// It uses the Relate Node.js client (@relate/relate) and the exact same
// seed script the browser app runs, so judges can inspect the same graph
// with the relate CLI or any Relate client, for example:
//
//   relate --database data/pathway.rl "MATCH (c:Course) RETURN count(c)"
//
// Run with: npm run seed

import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildSeedScript } from '../src/seedScript.js';

const require = createRequire(import.meta.url);
const { Database } = require('@relate/relate');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const storePath = join(root, 'data', 'pathway.rl');

mkdirSync(join(root, 'data'), { recursive: true });
rmSync(storePath, { force: true });

const db = Database.open(storePath);
const conn = db.connect();

// The Node client runs one statement per query() call, so split the
// script on statement boundaries and run each in order.
const statements = buildSeedScript()
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n')
  .split(';\n')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  conn.query(statement);
}
db.checkpoint();

const stats = conn.query(`
  MATCH (c:Course) WITH count(c) AS courses
  MATCH (t:Topic) WITH courses, count(t) AS topics
  MATCH (l:Lecturer) WITH courses, topics, count(l) AS lecturers
  MATCH ()-[r:REQUIRES]->() WITH courses, topics, lecturers, count(r) AS links
  RETURN courses, topics, lecturers, links
`).rows[0];

const chain = conn.query(`
  MATCH (target:Course {code: 'CPT401'})
  MATCH (foundation:Course) WHERE NOT (foundation)-[:REQUIRES]->()
  MATCH p = shortestPath((target)-[:REQUIRES*]->(foundation))
  RETURN [n IN nodes(p) | n.code] AS codes
  ORDER BY length(p) DESC LIMIT 1
`).rows[0];

console.log(`Persistent store written to data/pathway.rl`);
console.log(`Graph: ${stats.courses} courses, ${stats.links} prerequisite links, ${stats.topics} topics, ${stats.lecturers} lecturers`);
console.log(`Check query, shortest chain to CPT401: ${chain.codes.join(' -> ')}`);
