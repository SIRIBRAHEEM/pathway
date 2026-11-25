// Pure logic for Pathway. No DOM, no database, no React in here.
// Everything in this file is covered by tests/logic.test.mjs.

export const LEVELS = [100, 200, 300, 400];

/** Normalise a course code typed by a user: trim, uppercase, no spaces. */
export function normaliseCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Validate the add-course form. Returns { ok, errors } with plain messages. */
export function validateCourseInput(input, existingCodes) {
  const errors = [];
  const code = normaliseCode(input.code);
  if (!code) errors.push('Course code is required.');
  else if (!/^[A-Z]{2,4}\d{3}$/.test(code)) {
    errors.push('Course code should look like CPT201 (letters then three digits).');
  } else if (existingCodes.includes(code)) {
    errors.push(`Course ${code} already exists in the graph.`);
  }
  if (!String(input.title || '').trim()) errors.push('Course title is required.');
  const level = Number(input.level);
  if (!LEVELS.includes(level)) errors.push('Level must be 100, 200, 300 or 400.');
  const units = Number(input.units);
  if (!Number.isInteger(units) || units < 1 || units > 6) {
    errors.push('Units must be a whole number between 1 and 6.');
  }
  const prereqs = (input.prerequisites || []).map(normaliseCode).filter(Boolean);
  if (prereqs.includes(code)) errors.push('A course cannot be its own prerequisite.');
  for (const p of prereqs) {
    if (!existingCodes.includes(p)) errors.push(`Prerequisite ${p} is not in the graph yet.`);
  }
  return { ok: errors.length === 0, errors, code, prereqs };
}

/** Filter courses by a search text and an optional level. Case-insensitive. */
export function filterCourses(courses, query, level) {
  const q = String(query || '').trim().toLowerCase();
  return courses.filter((c) => {
    if (level && Number(level) !== c.level) return false;
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      (c.summary || '').toLowerCase().includes(q)
    );
  });
}

/**
 * Layered layout for the graph canvas.
 * Courses are grouped by level into columns (100 left, 400 right).
 * Inside a column they are sorted by semester then code, evenly spaced.
 * Returns a Map of code -> { x, y } plus the canvas size needed.
 */
export function layoutGraph(courses, options = {}) {
  const colWidth = options.colWidth || 230;
  const rowHeight = options.rowHeight || 92;
  const padX = options.padX || 90;
  const padY = options.padY || 70;

  const byLevel = new Map(LEVELS.map((l) => [l, []]));
  for (const c of courses) {
    if (!byLevel.has(c.level)) byLevel.set(c.level, []);
    byLevel.get(c.level).push(c);
  }
  const positions = new Map();
  let maxRows = 0;
  LEVELS.forEach((level, col) => {
    const list = byLevel.get(level) || [];
    list.sort((a, b) => a.semester - b.semester || a.code.localeCompare(b.code));
    maxRows = Math.max(maxRows, list.length);
    list.forEach((c, row) => {
      positions.set(c.code, { x: padX + col * colWidth, y: padY + row * rowHeight });
    });
  });
  return {
    positions,
    width: padX * 2 + (LEVELS.length - 1) * colWidth,
    height: padY * 2 + Math.max(0, maxRows - 1) * rowHeight,
  };
}

/**
 * Order a set of courses into a valid study sequence:
 * every prerequisite comes before the course that needs it.
 * `requires` is a list of [course, prerequisite] pairs.
 * Ties break by level, semester, then code, so the order is stable.
 * If a cycle exists, the remaining courses are appended in code order
 * and `hasCycle` is true.
 */
export function studyOrder(courses, requires) {
  const byCode = new Map(courses.map((c) => [c.code, c]));
  const needed = new Map(); // code -> Set of prerequisite codes still outstanding
  for (const c of courses) needed.set(c.code, new Set());
  for (const [course, prereq] of requires) {
    if (needed.has(course) && byCode.has(prereq)) needed.get(course).add(prereq);
  }
  const rank = (c) => [c.level, c.semester, c.code];
  const ordered = [];
  const done = new Set();
  let remaining = [...courses];
  while (remaining.length) {
    const ready = remaining
      .filter((c) => [...needed.get(c.code)].every((p) => done.has(p)))
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2]);
      });
    if (!ready.length) {
      const rest = remaining.sort((a, b) => a.code.localeCompare(b.code));
      return { order: [...ordered, ...rest], hasCycle: true };
    }
    const next = ready[0];
    ordered.push(next);
    done.add(next.code);
    remaining = remaining.filter((c) => c.code !== next.code);
  }
  return { order: ordered, hasCycle: false };
}

/** All transitive prerequisites of a course, from [course, prereq] pairs. */
export function allPrerequisites(code, requires) {
  const direct = new Map();
  for (const [course, prereq] of requires) {
    if (!direct.has(course)) direct.set(course, []);
    direct.get(course).push(prereq);
  }
  const seen = new Set();
  const stack = [...(direct.get(code) || [])];
  while (stack.length) {
    const next = stack.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...(direct.get(next) || []));
  }
  return [...seen];
}

/** Courses that directly or indirectly depend on `code` (what it unlocks). */
export function allDependents(code, requires) {
  const reverse = new Map();
  for (const [course, prereq] of requires) {
    if (!reverse.has(prereq)) reverse.set(prereq, []);
    reverse.get(prereq).push(course);
  }
  const seen = new Set();
  const stack = [...(reverse.get(code) || [])];
  while (stack.length) {
    const next = stack.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...(reverse.get(next) || []));
  }
  return [...seen];
}

/** Shortest chain (fewest hops) from a course down to a foundation course. */
export function shortestChain(code, requires) {
  const direct = new Map();
  for (const [course, prereq] of requires) {
    if (!direct.has(course)) direct.set(course, []);
    direct.get(course).push(prereq);
  }
  // Breadth first search down the prerequisite edges.
  const queue = [[code]];
  const visited = new Set([code]);
  let best = [code];
  while (queue.length) {
    const path = queue.shift();
    const head = path[path.length - 1];
    const nexts = direct.get(head) || [];
    if (!nexts.length) {
      if (path.length > best.length) best = path;
      continue;
    }
    for (const n of nexts) {
      if (visited.has(n)) continue;
      visited.add(n);
      queue.push([...path, n]);
    }
  }
  return best;
}

/** Progress summary for a set of completed course codes. */
export function progressSummary(courses, completedCodes) {
  const completed = new Set(completedCodes);
  const totalUnits = courses.reduce((sum, c) => sum + c.units, 0);
  const doneUnits = courses
    .filter((c) => completed.has(c.code))
    .reduce((sum, c) => sum + c.units, 0);
  const byLevel = LEVELS.map((level) => {
    const inLevel = courses.filter((c) => c.level === level);
    const done = inLevel.filter((c) => completed.has(c.code)).length;
    return { level, done, total: inLevel.length };
  });
  return {
    doneCourses: courses.filter((c) => completed.has(c.code)).length,
    totalCourses: courses.length,
    doneUnits,
    totalUnits,
    percent: totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0,
    byLevel,
  };
}

/**
 * Which courses a student can take next: not completed, and every
 * prerequisite completed (or no prerequisites at all).
 */
export function readyNext(courses, requires, completedCodes) {
  const completed = new Set(completedCodes);
  const prereqMap = new Map();
  for (const [course, prereq] of requires) {
    if (!prereqMap.has(course)) prereqMap.set(course, []);
    prereqMap.get(course).push(prereq);
  }
  return courses
    .filter((c) => !completed.has(c.code))
    .filter((c) => (prereqMap.get(c.code) || []).every((p) => completed.has(p)))
    .sort((a, b) => a.level - b.level || a.semester - b.semester || a.code.localeCompare(b.code));
}

/** Escape a string for safe use inside a single-quoted Cypher literal. */
export function cypherString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
