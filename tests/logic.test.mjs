import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseCode,
  validateCourseInput,
  filterCourses,
  layoutGraph,
  studyOrder,
  allPrerequisites,
  allDependents,
  shortestChain,
  progressSummary,
  readyNext,
  cypherString,
} from '../src/logic.js';
import { COURSES, REQUIRES } from '../src/seedData.js';
import { buildSeedScript, SEED_COUNTS } from '../src/seedScript.js';

test('normaliseCode trims, uppercases and removes spaces', () => {
  assert.equal(normaliseCode(' cpt 201 '), 'CPT201');
  assert.equal(normaliseCode(''), '');
  assert.equal(normaliseCode(null), '');
});

test('validateCourseInput accepts a good course', () => {
  const codes = COURSES.map((c) => c.code);
  const r = validateCourseInput(
    { code: 'cpt309', title: 'Web Development', level: 300, units: 3, prerequisites: ['CPT204'] },
    codes,
  );
  assert.equal(r.ok, true);
  assert.equal(r.code, 'CPT309');
  assert.deepEqual(r.prereqs, ['CPT204']);
});

test('validateCourseInput rejects duplicates, bad codes and self-prerequisite', () => {
  const codes = COURSES.map((c) => c.code);
  const dup = validateCourseInput({ code: 'CPT101', title: 'X', level: 100, units: 3 }, codes);
  assert.equal(dup.ok, false);
  assert.match(dup.errors.join(' '), /already exists/);
  const bad = validateCourseInput({ code: 'XYZ', title: 'X', level: 100, units: 3 }, codes);
  assert.equal(bad.ok, false);
  const self = validateCourseInput(
    { code: 'CPT309', title: 'X', level: 300, units: 3, prerequisites: ['CPT309'] },
    codes,
  );
  assert.equal(self.ok, false);
  assert.match(self.errors.join(' '), /own prerequisite/);
});

test('validateCourseInput rejects unknown prerequisites and bad units', () => {
  const codes = COURSES.map((c) => c.code);
  const r = validateCourseInput(
    { code: 'CPT309', title: 'X', level: 300, units: 9, prerequisites: ['CPT999'] },
    codes,
  );
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /Units/);
  assert.match(r.errors.join(' '), /CPT999/);
});

test('filterCourses matches code, title and summary, and respects level', () => {
  assert.ok(filterCourses(COURSES, 'cpt401', '').some((c) => c.code === 'CPT401'));
  assert.ok(filterCourses(COURSES, 'networks', '').some((c) => c.code === 'CPT302'));
  assert.ok(filterCourses(COURSES, 'SQL', '').some((c) => c.code === 'CPT206'));
  const only100 = filterCourses(COURSES, '', 100);
  assert.ok(only100.length > 0 && only100.every((c) => c.level === 100));
  assert.equal(filterCourses(COURSES, 'zzzznope', '').length, 0);
});

test('layoutGraph places every course once, 100 level left of 400 level', () => {
  const { positions, width, height } = layoutGraph(COURSES);
  assert.equal(positions.size, COURSES.length);
  const c100 = positions.get('CPT101');
  const c400 = positions.get('CPT401');
  assert.ok(c100.x < c400.x);
  assert.ok(width > 0 && height > 0);
  // No two nodes share a position.
  const seen = new Set([...positions.values()].map((p) => `${p.x},${p.y}`));
  assert.equal(seen.size, positions.size);
});

test('studyOrder puts every prerequisite before its course', () => {
  const { order, hasCycle } = studyOrder(COURSES, REQUIRES);
  assert.equal(hasCycle, false);
  assert.equal(order.length, COURSES.length);
  const index = new Map(order.map((c, i) => [c.code, i]));
  for (const [course, prereq] of REQUIRES) {
    assert.ok(index.get(prereq) < index.get(course), `${prereq} must come before ${course}`);
  }
});

test('studyOrder reports a cycle instead of looping forever', () => {
  const courses = [
    { code: 'AAA101', title: 'A', level: 100, semester: 1, units: 3 },
    { code: 'BBB101', title: 'B', level: 100, semester: 1, units: 3 },
  ];
  const { order, hasCycle } = studyOrder(courses, [
    ['AAA101', 'BBB101'],
    ['BBB101', 'AAA101'],
  ]);
  assert.equal(hasCycle, true);
  assert.equal(order.length, 2);
});

test('allPrerequisites walks the full chain for CPT401', () => {
  const all = allPrerequisites('CPT401', REQUIRES);
  for (const code of ['CPT307', 'CPT205', 'CPT201', 'CPT104', 'CPT102', 'CPT101', 'MTH201']) {
    assert.ok(all.includes(code), `${code} should be a prerequisite of CPT401`);
  }
  assert.ok(!all.includes('CPT401'));
});

test('allDependents finds what CPT101 unlocks', () => {
  const deps = allDependents('CPT101', REQUIRES);
  assert.ok(deps.includes('CPT102'));
  assert.ok(deps.includes('CPT401'));
  assert.ok(!deps.includes('MTH101'));
});

test('shortestChain ends at a foundation course', () => {
  const chain = shortestChain('CPT401', REQUIRES);
  assert.equal(chain[0], 'CPT401');
  const last = chain[chain.length - 1];
  assert.ok(!REQUIRES.some(([course]) => course === last), `${last} should have no prerequisites`);
  // Each step is a real prerequisite edge.
  for (let i = 0; i < chain.length - 1; i++) {
    assert.ok(
      REQUIRES.some(([a, b]) => a === chain[i] && b === chain[i + 1]),
      `${chain[i]} -> ${chain[i + 1]} must be an edge`,
    );
  }
});

test('progressSummary counts courses and units', () => {
  const p = progressSummary(COURSES, ['CPT101', 'CPT102']);
  assert.equal(p.doneCourses, 2);
  assert.equal(p.doneUnits, 6);
  assert.equal(p.totalCourses, COURSES.length);
  assert.ok(p.percent > 0 && p.percent < 100);
  assert.equal(p.byLevel.length, 4);
});

test('readyNext only returns courses whose prerequisites are done', () => {
  const none = readyNext(COURSES, REQUIRES, []);
  assert.ok(none.some((c) => c.code === 'CPT101'));
  assert.ok(!none.some((c) => c.code === 'CPT102'));
  const after101 = readyNext(COURSES, REQUIRES, ['CPT101']);
  assert.ok(after101.some((c) => c.code === 'CPT102'));
  assert.ok(!after101.some((c) => c.code === 'CPT101'));
});

test('cypherString escapes quotes and backslashes', () => {
  assert.equal(cypherString("it's"), "it\\'s");
  assert.equal(cypherString('a\\b'), 'a\\\\b');
});

test('seed script creates every course, topic, lecturer and edge once', () => {
  const script = buildSeedScript();
  const count = (needle) => script.split(needle).length - 1;
  assert.equal(count('CREATE (:Course'), SEED_COUNTS.courses);
  assert.equal(count('CREATE (:Topic'), SEED_COUNTS.topics);
  assert.equal(count('CREATE (:Lecturer'), SEED_COUNTS.lecturers);
  assert.equal(count('[:REQUIRES]'), SEED_COUNTS.requires);
  assert.equal(count('[:COVERS]'), SEED_COUNTS.covers);
  assert.equal(count('[:TEACHES]'), SEED_COUNTS.teaches);
});

test('seed data has no dangling references', () => {
  const codes = new Set(COURSES.map((c) => c.code));
  for (const [a, b] of REQUIRES) {
    assert.ok(codes.has(a), `unknown course ${a}`);
    assert.ok(codes.has(b), `unknown prerequisite ${b}`);
  }
});
