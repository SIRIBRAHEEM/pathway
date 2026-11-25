import { useEffect, useMemo, useRef, useState } from 'react';
import { run, resetGraph, lastQuery } from './relateClient.js';
import {
  ENGINE_VERSION,
  STATS,
  ALL_COURSES,
  ALL_REQUIRES,
  ALL_TOPICS,
  COURSE_DETAIL,
  SHORTEST_PATH_TO_FOUNDATION,
  FULL_PREREQUISITE_SET,
  TOPIC_COURSES,
  SET_COMPLETED,
  ADD_COURSE,
  LINK_PREREQUISITE,
  DELETE_COURSE,
} from './cypher.js';
import {
  LEVELS,
  filterCourses,
  layoutGraph,
  studyOrder,
  progressSummary,
  readyNext,
  validateCourseInput,
  normaliseCode,
} from './logic.js';

const NODE_W = 150;
const NODE_H = 56;

function levelColour(level) {
  return { 100: '#0e7c86', 200: '#2f6db3', 300: '#7a4fa3', 400: '#c2571b' }[level] || '#44506b';
}

export default function App() {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorText, setErrorText] = useState('');
  const [engineVersion, setEngineVersion] = useState('');
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [requires, setRequires] = useState([]); // [course, prerequisite]
  const [topics, setTopics] = useState([]);
  const [selected, setSelected] = useState(null); // course code
  const [detail, setDetail] = useState(null);
  const [chain, setChain] = useState([]); // codes on the shortest chain
  const [fullSet, setFullSet] = useState([]); // all prerequisite codes of selected
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [tab, setTab] = useState('detail'); // detail | path | add
  const [pathTarget, setPathTarget] = useState('');
  const [pathPlan, setPathPlan] = useState(null);
  const [topicCourses, setTopicCourses] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    code: '', title: '', level: 200, semester: 1, units: 3, summary: '', prerequisites: [],
  });
  const [formErrors, setFormErrors] = useState([]);
  const [queryInfo, setQueryInfo] = useState({ statement: '', elapsedMs: null, storeMode: 'opfs' });
  const svgWrapRef = useRef(null);

  async function refresh() {
    const [statsRes, coursesRes, reqRes, topicsRes] = await Promise.all([
      run(STATS),
      run(ALL_COURSES),
      run(ALL_REQUIRES),
      run(ALL_TOPICS),
    ]);
    setStats(statsRes.rows[0] || null);
    setCourses(coursesRes.rows);
    setRequires(reqRes.rows.map((r) => [r.course, r.prerequisite]));
    setTopics(topicsRes.rows);
    setQueryInfo({ ...lastQuery });
  }

  useEffect(() => {
    (async () => {
      try {
        const v = await run(ENGINE_VERSION);
        setEngineVersion(v.rows[0]?.version || '');
        await refresh();
        setStatus('ready');
      } catch (err) {
        setErrorText(err.message);
        setStatus('error');
      }
    })();
  }, []);

  async function selectCourse(code) {
    setSelected(code);
    setTab('detail');
    try {
      const [d, full, shortest] = await Promise.allSettled([
        run(COURSE_DETAIL, { code }),
        run(FULL_PREREQUISITE_SET, { code }),
        run(SHORTEST_PATH_TO_FOUNDATION, { code }),
      ]);
      if (d.status === 'fulfilled') setDetail(d.value.rows[0] || null);
      else throw d.reason;
      setFullSet(full.status === 'fulfilled' ? full.value.rows[0]?.codes || [] : []);
      setChain(shortest.status === 'fulfilled' ? shortest.value.rows[0]?.codes || [] : []);
      setQueryInfo({ ...lastQuery });
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function toggleCompleted(course) {
    try {
      await run(SET_COMPLETED, { code: course.code, completed: !course.completed });
      await refresh();
      if (selected === course.code) await selectCourse(course.code);
      setNotice(
        !course.completed
          ? `${course.code} marked as completed. It is saved in the graph.`
          : `${course.code} marked as not completed yet.`,
      );
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function buildPath() {
    const code = normaliseCode(pathTarget);
    if (!code) return;
    try {
      const full = await run(FULL_PREREQUISITE_SET, { code });
      const needed = new Set([code, ...(full.rows[0]?.codes || [])]);
      const subset = courses.filter((c) => needed.has(c.code));
      const subsetReq = requires.filter(([a, b]) => needed.has(a) && needed.has(b));
      const { order, hasCycle } = studyOrder(subset, subsetReq);
      const shortest = await run(SHORTEST_PATH_TO_FOUNDATION, { code });
      setPathPlan({ target: code, order, hasCycle, chain: shortest.rows[0]?.codes || [] });
      setChain(shortest.rows[0]?.codes || []);
      setSelected(code);
      setQueryInfo({ ...lastQuery });
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function showTopic(topic) {
    try {
      const res = await run(TOPIC_COURSES, { topic });
      setTopicCourses({ topic, rows: res.rows });
      setQueryInfo({ ...lastQuery });
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function submitCourse(event) {
    event.preventDefault();
    const codes = courses.map((c) => c.code);
    const check = validateCourseInput(form, codes);
    setFormErrors(check.errors);
    if (!check.ok) return;
    try {
      await run(ADD_COURSE, {
        code: check.code,
        title: form.title.trim(),
        level: Number(form.level),
        semester: Number(form.semester),
        units: Number(form.units),
        summary: form.summary.trim() || 'Added by a student.',
      });
      for (const prereq of check.prereqs) {
        await run(LINK_PREREQUISITE, { course: check.code, prerequisite: prereq });
      }
      setForm({ code: '', title: '', level: 200, semester: 1, units: 3, summary: '', prerequisites: [] });
      await refresh();
      await selectCourse(check.code);
      setNotice(`${check.code} added to the graph and saved. Reload the page: it will still be here.`);
    } catch (err) {
      setFormErrors([err.message]);
    }
  }

  async function removeCourse(code) {
    try {
      await run(DELETE_COURSE, { code });
      setSelected(null);
      setDetail(null);
      setChain([]);
      await refresh();
      setNotice(`${code} removed from the graph.`);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function doReset() {
    try {
      await resetGraph();
      setSelected(null);
      setDetail(null);
      setChain([]);
      setPathPlan(null);
      await refresh();
      setNotice('Graph reset to the sample course map.');
    } catch (err) {
      setNotice(err.message);
    }
  }

  const visible = useMemo(() => filterCourses(courses, query, levelFilter), [courses, query, levelFilter]);
  const layout = useMemo(() => layoutGraph(courses), [courses]);
  const completedCodes = useMemo(() => courses.filter((c) => c.completed).map((c) => c.code), [courses]);
  const progress = useMemo(() => progressSummary(courses, completedCodes), [courses, completedCodes]);
  const nextUp = useMemo(() => readyNext(courses, requires, completedCodes), [courses, requires, completedCodes]);
  const chainSet = useMemo(() => new Set(chain), [chain]);
  const fullSetSet = useMemo(() => new Set(fullSet), [fullSet]);
  const visibleCodes = useMemo(() => new Set(visible.map((c) => c.code)), [visible]);

  if (status === 'loading') {
    return (
      <div className="boot">
        <h1>Pathway</h1>
        <p>Starting the Relate graph engine in your browser...</p>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="boot">
        <h1>Pathway</h1>
        <p>The graph engine could not start: {errorText}</p>
        <p>Try a recent Chrome or Edge browser, which supports WebAssembly workers and OPFS storage.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 34 34">
              <circle cx="8" cy="26" r="4.5" fill="#0e7c86" />
              <circle cx="17" cy="17" r="4.5" fill="#2f6db3" />
              <circle cx="26" cy="8" r="4.5" fill="#f59e0b" />
              <path d="M11 23 L14 20 M20 14 L23 11" stroke="#1b2a4a" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h1>Pathway</h1>
            <p>Course prerequisite graph explorer</p>
          </div>
        </div>
        <div className="topbar-stats">
          {stats && (
            <>
              <span><strong>{stats.courses}</strong> courses</span>
              <span><strong>{stats.links}</strong> prerequisite links</span>
              <span><strong>{stats.topics}</strong> topics</span>
              <span><strong>{stats.lecturers}</strong> lecturers</span>
            </>
          )}
          <span className="engine-badge" title="Embedded graph database running in this tab">
            Relate {engineVersion} in browser
          </span>
        </div>
      </header>

      <p className="intro">
        University courses form a graph: some courses unlock others. Pathway stores that graph in
        Relate, an embedded graph database running right here in your browser, and answers questions
        like <em>what must I pass before Machine Learning?</em> with real graph traversals.
        Sample data: a computer science programme in the style of FUTMINNA, with fictional lecturers.
      </p>

      {notice && (
        <div className="notice" role="status">
          {notice}
          <button className="notice-close" onClick={() => setNotice('')} aria-label="Dismiss">x</button>
        </div>
      )}

      <main className="layout">
        <aside className="panel left">
          <h2>Find a course</h2>
          <label className="field">
            <span>Search by code, title or keyword</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: CPT401, networks, SQL"
            />
          </label>
          <label className="field">
            <span>Level</span>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
              <option value="">All levels</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l} level</option>
              ))}
            </select>
          </label>

          <div className="progress-box">
            <h3>Your progress</h3>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p>
              {progress.doneCourses} of {progress.totalCourses} courses, {progress.doneUnits} of{' '}
              {progress.totalUnits} units ({progress.percent}%)
            </p>
            <ul className="progress-levels">
              {progress.byLevel.map((row) => (
                <li key={row.level}>
                  <span>{row.level} level</span>
                  <strong>{row.done}/{row.total}</strong>
                </li>
              ))}
            </ul>
          </div>

          <h3>Ready to take next</h3>
          {nextUp.length === 0 ? (
            <p className="muted">Nothing is unlocked right now. Mark a foundation course as completed.</p>
          ) : (
            <ul className="chip-list">
              {nextUp.slice(0, 8).map((c) => (
                <li key={c.code}>
                  <button className="chip" onClick={() => selectCourse(c.code)}>
                    {c.code} <span>{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3>Browse by topic</h3>
          <ul className="chip-list">
            {topics.slice(0, 12).map((t) => (
              <li key={t.name}>
                <button
                  className={`chip ${topicCourses?.topic === t.name ? 'chip-on' : ''}`}
                  onClick={() => showTopic(t.name)}
                >
                  {t.name} <span>({t.courses})</span>
                </button>
              </li>
            ))}
          </ul>
          {topicCourses && (
            <div className="topic-results">
              <h4>Courses covering {topicCourses.topic}</h4>
              <ul>
                {topicCourses.rows.map((r) => (
                  <li key={r.code}>
                    <button className="linklike" onClick={() => selectCourse(r.code)}>
                      {r.code} - {r.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3>All courses ({visible.length})</h3>
          <ul className="course-list">
            {visible.map((c) => (
              <li key={c.code}>
                <button
                  className={`course-row ${selected === c.code ? 'course-row-on' : ''}`}
                  onClick={() => selectCourse(c.code)}
                >
                  <span className="course-code" style={{ color: levelColour(c.level) }}>{c.code}</span>
                  <span className="course-title">{c.title}</span>
                  {c.completed && <span className="done-tag">done</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="panel canvas-panel">
          <div className="canvas-head">
            <h2>Course graph</h2>
            <div className="canvas-tools">
              <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>Zoom out</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>Zoom in</button>
              <button onClick={() => setZoom(1)}>Reset view</button>
            </div>
          </div>
          <p className="muted small">
            Columns are levels, 100 on the left to 400 on the right. An arrow points from a course
            to a prerequisite it needs. Click any course to inspect it.
          </p>
          <div className="canvas-wrap" ref={svgWrapRef}>
            <svg
              width={layout.width * zoom}
              height={layout.height * zoom}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              role="img"
              aria-label="Graph of courses and their prerequisites"
            >
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 z" fill="#8a94a6" />
                </marker>
                <marker id="arrow-hot" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 z" fill="#f59e0b" />
                </marker>
              </defs>
              {requires.map(([a, b]) => {
                const pa = layout.positions.get(a);
                const pb = layout.positions.get(b);
                if (!pa || !pb) return null;
                const hot = chainSet.has(a) && chainSet.has(b);
                const dim = (query || levelFilter) && !(visibleCodes.has(a) && visibleCodes.has(b));
                const x1 = pa.x;
                const y1 = pa.y;
                const x2 = pb.x + NODE_W;
                const y2 = pb.y + NODE_H / 2;
                const midX = (x1 + x2) / 2;
                return (
                  <path
                    key={`${a}-${b}`}
                    d={`M ${x1} ${y1 + NODE_H / 2} C ${midX} ${y1 + NODE_H / 2}, ${midX} ${y2}, ${x2 + 4} ${y2}`}
                    fill="none"
                    stroke={hot ? '#f59e0b' : '#b9c2d0'}
                    strokeWidth={hot ? 3 : 1.6}
                    opacity={dim ? 0.25 : 1}
                    markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'}
                  />
                );
              })}
              {courses.map((c) => {
                const p = layout.positions.get(c.code);
                if (!p) return null;
                const isSel = selected === c.code;
                const onChain = chainSet.has(c.code);
                const inFull = fullSetSet.has(c.code);
                const dim = (query || levelFilter) && !visibleCodes.has(c.code);
                return (
                  <g
                    key={c.code}
                    transform={`translate(${p.x}, ${p.y})`}
                    className="node"
                    opacity={dim ? 0.3 : 1}
                    onClick={() => selectCourse(c.code)}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx="10"
                      className="node-box"
                      style={{
                        stroke: isSel ? '#f59e0b' : onChain ? '#f59e0b' : levelColour(c.level),
                        strokeWidth: isSel ? 3 : onChain ? 2.4 : 1.6,
                        fill: c.completed ? '#e7f4ec' : inFull ? '#fff4e0' : '#ffffff',
                      }}
                    />
                    <text x="10" y="22" className="node-code" fill={levelColour(c.level)}>
                      {c.code}
                      {c.completed ? '  ✓' : ''}
                    </text>
                    <text x="10" y="42" className="node-title">
                      {c.title.length > 24 ? `${c.title.slice(0, 23)}...` : c.title}
                    </text>
                  </g>
                );
              })}
              {LEVELS.map((level, i) => (
                <text
                  key={level}
                  x={90 + i * 230 + NODE_W / 2}
                  y={34}
                  textAnchor="middle"
                  className="level-label"
                  fill={levelColour(level)}
                >
                  {level} LEVEL
                </text>
              ))}
            </svg>
          </div>
          <div className="legend">
            <span><i className="swatch" style={{ background: '#e7f4ec', borderColor: '#3d9970' }} /> completed</span>
            <span><i className="swatch" style={{ background: '#fff4e0', borderColor: '#f59e0b' }} /> needed before selected</span>
            <span><i className="swatch" style={{ background: '#ffffff', borderColor: '#f59e0b' }} /> shortest chain highlighted</span>
          </div>
        </section>

        <aside className="panel right">
          <div className="tabs" role="tablist">
            <button className={tab === 'detail' ? 'tab-on' : ''} onClick={() => setTab('detail')}>Course</button>
            <button className={tab === 'path' ? 'tab-on' : ''} onClick={() => setTab('path')}>Path finder</button>
            <button className={tab === 'add' ? 'tab-on' : ''} onClick={() => setTab('add')}>Add course</button>
          </div>

          {tab === 'detail' && (
            <div>
              {!detail ? (
                <p className="muted">Select a course on the graph or in the list to see its prerequisites, topics and lecturer.</p>
              ) : (
                <>
                  <h2>
                    <span className="course-code" style={{ color: levelColour(detail.level) }}>{detail.code}</span>{' '}
                    {detail.title}
                  </h2>
                  <p className="meta-line">
                    {detail.level} level, semester {detail.semester}, {detail.units} units
                  </p>
                  <p>{detail.summary}</p>
                  <button className="primary" onClick={() => toggleCompleted(detail)}>
                    {detail.completed ? 'Mark as not completed' : 'Mark as completed'}
                  </button>

                  <h3>Direct prerequisites</h3>
                  {detail.prerequisites.filter(Boolean).length ? (
                    <ul className="chip-list">
                      {detail.prerequisites.filter(Boolean).map((code) => (
                        <li key={code}>
                          <button className="chip" onClick={() => selectCourse(code)}>{code}</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">None. This is a foundation course.</p>
                  )}

                  <h3>Everything needed before it ({fullSet.length})</h3>
                  <p className="small">
                    Found by traversing REQUIRES edges in Relate. Amber nodes on the graph are in this set.
                  </p>
                  <ul className="chip-list">
                    {[...fullSet].sort().map((code) => (
                      <li key={code}>
                        <button className="chip" onClick={() => selectCourse(code)}>{code}</button>
                      </li>
                    ))}
                  </ul>

                  <h3>Shortest chain to a foundation</h3>
                  <p className="chain-line">{chain.length ? chain.join('  ->  ') : 'Not computed yet.'}</p>

                  <h3>Unlocks</h3>
                  {detail.unlocks.filter(Boolean).length ? (
                    <ul className="chip-list">
                      {detail.unlocks.filter(Boolean).map((code) => (
                        <li key={code}>
                          <button className="chip" onClick={() => selectCourse(code)}>{code}</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No course lists this one as a prerequisite.</p>
                  )}

                  <h3>Topics covered</h3>
                  <ul className="chip-list">
                    {detail.topics.filter(Boolean).map((t) => (
                      <li key={t}>
                        <button className="chip" onClick={() => showTopic(t)}>{t}</button>
                      </li>
                    ))}
                  </ul>

                  <h3>Lecturer</h3>
                  <p>{detail.lecturers.filter(Boolean).join(', ') || 'Not assigned in sample data.'}</p>

                  <button className="danger" onClick={() => removeCourse(detail.code)}>
                    Remove {detail.code} from the graph
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'path' && (
            <div>
              <h2>Path finder</h2>
              <p>
                Pick a target course. Pathway asks Relate for every course reachable through
                prerequisite edges, then orders them into a study sequence you can actually follow.
              </p>
              <label className="field">
                <span>Target course</span>
                <select value={pathTarget} onChange={(e) => setPathTarget(e.target.value)}>
                  <option value="">Choose a course...</option>
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" onClick={buildPath} disabled={!pathTarget}>
                Build my study path
              </button>
              {pathPlan && (
                <div className="path-result">
                  <h3>Study sequence for {pathPlan.target}</h3>
                  <p className="small">
                    {pathPlan.order.length} courses, in an order where every prerequisite comes first.
                    {pathPlan.hasCycle ? ' Warning: a cycle was detected in the data.' : ''}
                  </p>
                  <ol className="path-list">
                    {pathPlan.order.map((c) => (
                      <li key={c.code} className={c.code === pathPlan.target ? 'path-target' : ''}>
                        <button className="linklike" onClick={() => selectCourse(c.code)}>
                          {c.code}
                        </button>{' '}
                        {c.title}
                        <span className="path-meta">
                          {c.level} level, sem {c.semester}
                          {c.completed ? ', done' : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <h3>Shortest chain</h3>
                  <p className="chain-line">{pathPlan.chain.join('  ->  ')}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'add' && (
            <form onSubmit={submitCourse}>
              <h2>Add your own course</h2>
              <p className="small">
                It is written into the Relate graph and saved in the persistent store, so it is
                still here after a reload.
              </p>
              {formErrors.length > 0 && (
                <ul className="form-errors">
                  {formErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              <label className="field">
                <span>Course code</span>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="CPT309"
                />
              </label>
              <label className="field">
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Web Development"
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Level</span>
                  <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Semester</span>
                  <select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </label>
                <label className="field">
                  <span>Units</span>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={form.units}
                    onChange={(e) => setForm({ ...form, units: e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                <span>Short summary</span>
                <textarea
                  rows="2"
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="What will students learn?"
                />
              </label>
              <label className="field">
                <span>Prerequisites (hold Ctrl or Cmd for several)</span>
                <select
                  multiple
                  size="6"
                  value={form.prerequisites}
                  onChange={(e) =>
                    setForm({ ...form, prerequisites: [...e.target.selectedOptions].map((o) => o.value) })
                  }
                >
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" type="submit">Add to graph</button>
            </form>
          )}

          <div className="reset-box">
            <h3>Sample data</h3>
            <p className="small">Restore the original sample course map. This clears your changes in the store.</p>
            <button onClick={doReset}>Reset sample graph</button>
          </div>
        </aside>
      </main>

      <footer className="hood">
        <h2>Under the hood</h2>
        <p>
          The graph lives in <strong>Relate {engineVersion}</strong>, an embedded graph database
          (Neo4j Labs) compiled to WebAssembly and running in a Web Worker in this tab.
          Store mode: <strong>{queryInfo.storeMode === 'opfs' ? 'persistent OPFS store (opfs://pathway)' : 'in-memory fallback'}</strong>.
          Every screen above is driven by Cypher queries against that store. The most recent one:
        </p>
        <pre className="cypher-box">{queryInfo.statement || 'No query yet.'}</pre>
        <p className="small">
          Engine time: {queryInfo.elapsedMs == null ? 'n/a' : `${queryInfo.elapsedMs} ms`}.
          No server, no account, works offline after first load.
        </p>
      </footer>
    </div>
  );
}
