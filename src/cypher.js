// Every Cypher statement Pathway sends to Relate lives in this file.
// The app talks to the embedded Relate engine in a Web Worker; these are
// the exact statements it runs. Parameters are always bound with $name,
// never pasted into the text.

export const ENGINE_VERSION = `
CALL dbms.components() YIELD name, versions
WHERE name = 'Relate'
RETURN versions[0] AS version
`;

export const COUNT_COURSES = `MATCH (c:Course) RETURN count(c) AS n`;

export const STATS = `
MATCH (c:Course) WITH count(c) AS courses
MATCH (t:Topic) WITH courses, count(t) AS topics
MATCH (l:Lecturer) WITH courses, topics, count(l) AS lecturers
MATCH ()-[r:REQUIRES]->() WITH courses, topics, lecturers, count(r) AS links
RETURN courses, topics, lecturers, links
`;

export const ALL_COURSES = `
MATCH (c:Course)
RETURN c.code AS code, c.title AS title, c.level AS level,
       c.semester AS semester, c.units AS units, c.summary AS summary,
       coalesce(c.completed, false) AS completed
ORDER BY c.level, c.semester, c.code
`;

export const ALL_REQUIRES = `
MATCH (a:Course)-[:REQUIRES]->(b:Course)
RETURN a.code AS course, b.code AS prerequisite
`;

export const COURSE_DETAIL = `
MATCH (c:Course {code: $code})
OPTIONAL MATCH (c)-[:REQUIRES]->(p:Course)
OPTIONAL MATCH (d:Course)-[:REQUIRES]->(c)
OPTIONAL MATCH (c)-[:COVERS]->(t:Topic)
OPTIONAL MATCH (l:Lecturer)-[:TEACHES]->(c)
RETURN c.code AS code, c.title AS title, c.level AS level,
       c.semester AS semester, c.units AS units, c.summary AS summary,
       coalesce(c.completed, false) AS completed,
       collect(DISTINCT p.code) AS prerequisites,
       collect(DISTINCT d.code) AS unlocks,
       collect(DISTINCT t.name) AS topics,
       collect(DISTINCT l.name) AS lecturers
`;

// The signature graph query: shortest prerequisite chain from a target
// course down to a foundation course (one with no prerequisites).
// The 0 lower bound matters: when the target is itself a foundation
// course, the chain is just that course, and a plain * would error
// because start and end would be the same node.
export const SHORTEST_PATH_TO_FOUNDATION = `
MATCH (target:Course {code: $code})
MATCH (foundation:Course)
WHERE NOT (foundation)-[:REQUIRES]->()
MATCH p = shortestPath((target)-[:REQUIRES*0..12]->(foundation))
RETURN [n IN nodes(p) | n.code] AS codes, length(p) AS hops
ORDER BY hops DESC
LIMIT 1
`;

// Every course needed before the target, found by traversal in the graph.
export const FULL_PREREQUISITE_SET = `
MATCH (target:Course {code: $code})-[:REQUIRES*1..12]->(pre:Course)
RETURN collect(DISTINCT pre.code) AS codes
`;

export const TOPIC_COURSES = `
MATCH (c:Course)-[:COVERS]->(t:Topic {name: $topic})
RETURN c.code AS code, c.title AS title
ORDER BY c.level, c.code
`;

export const ALL_TOPICS = `
MATCH (t:Topic)
OPTIONAL MATCH (c:Course)-[:COVERS]->(t)
RETURN t.name AS name, count(c) AS courses
ORDER BY courses DESC, name
`;

export const SET_COMPLETED = `
MATCH (c:Course {code: $code})
SET c.completed = $completed
RETURN c.code AS code, c.completed AS completed
`;

export const ADD_COURSE = `
CREATE (c:Course {code: $code, title: $title, level: $level,
                  semester: $semester, units: $units, summary: $summary,
                  completed: false})
RETURN c.code AS code
`;

export const LINK_PREREQUISITE = `
MATCH (a:Course {code: $course}), (b:Course {code: $prerequisite})
CREATE (a)-[:REQUIRES]->(b)
RETURN a.code AS course, b.code AS prerequisite
`;

export const DELETE_COURSE = `
MATCH (c:Course {code: $code})
DETACH DELETE c
`;

export const RESET_GRAPH = `MATCH (n) DETACH DELETE n`;
