// Builds the Cypher seed script from seedData.js.
// Used twice: by the browser worker (Relate WASM, OPFS store) and by
// scripts/seed-store.mjs (Relate Node client, single-file store in data/).

import { COURSES, REQUIRES, TOPICS, COVERS, LECTURERS, TEACHES } from './seedData.js';
import { cypherString } from './logic.js';

export function buildSeedScript() {
  const lines = [];

  lines.push('// Pathway seed graph: courses, topics, lecturers, prerequisites.');

  for (const c of COURSES) {
    lines.push(
      `CREATE (:Course {code: '${cypherString(c.code)}', title: '${cypherString(c.title)}', ` +
        `level: ${c.level}, semester: ${c.semester}, units: ${c.units}, ` +
        `summary: '${cypherString(c.summary)}', completed: false});`,
    );
  }
  for (const t of TOPICS) {
    lines.push(`CREATE (:Topic {name: '${cypherString(t)}'});`);
  }
  for (const l of LECTURERS) {
    lines.push(
      `CREATE (:Lecturer {name: '${cypherString(l.name)}', rank: '${cypherString(l.rank)}'});`,
    );
  }
  for (const [course, prereq] of REQUIRES) {
    lines.push(
      `MATCH (a:Course {code: '${course}'}), (b:Course {code: '${prereq}'}) CREATE (a)-[:REQUIRES]->(b);`,
    );
  }
  for (const [course, topic] of COVERS) {
    lines.push(
      `MATCH (c:Course {code: '${course}'}), (t:Topic {name: '${cypherString(topic)}'}) CREATE (c)-[:COVERS]->(t);`,
    );
  }
  for (const [lecturer, course] of TEACHES) {
    lines.push(
      `MATCH (l:Lecturer {name: '${cypherString(lecturer)}'}), (c:Course {code: '${course}'}) CREATE (l)-[:TEACHES]->(c);`,
    );
  }
  return lines.join('\n');
}

export const SEED_COUNTS = {
  courses: COURSES.length,
  topics: TOPICS.length,
  lecturers: LECTURERS.length,
  requires: REQUIRES.length,
  covers: COVERS.length,
  teaches: TEACHES.length,
};
