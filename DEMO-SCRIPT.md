# Pathway demo script (1 to 2 minutes)

Screen recording of the live app, 1280x800 or wider. Cursor visible with a
click ripple on every click. Short feature labels on screen per scene.
No face circle, no photo anywhere. Narration is the entrant's own voice or
a clean voiceover, levelled and clear. Total target: about 1 minute 40
seconds, safely inside the 2 minute limit.

## Scene 1 - Introduction (0:00 to 0:12)

On screen: title card for 2 seconds (Pathway, "See the shortest route to
any course"), then the app already loaded with the full course graph.

Say: "Hello, I am Ibrahim, a student at FUT Minna. This is Pathway, a
course prerequisite graph explorer. It stores my whole course map in
Relate, the embedded graph database from Neo4j, running right here in
the browser. Let me show you what it answers."

## Scene 2 - The graph (0:12 to 0:28)

On screen: pan across the graph columns, 100 level on the left to 400
level on the right. Hover a node or two.

Say: "Every course is a node. Every arrow is a prerequisite: this course
needs that one first. Topics and lecturers are in the graph too. This is
a computer science programme with 33 courses and 43 prerequisite links,
all of it one graph in Relate."

## Scene 3 - Course detail (0:28 to 0:52)

On screen: click CPT401 Machine Learning. The chain lights up amber.
Show the detail panel: direct prerequisites, everything needed before
it, shortest chain, lecturer.

Say: "I click Machine Learning, CPT401. Pathway runs a Cypher traversal
and finds the 12 courses I need before it. It also computes the shortest
chain down to a foundation course with shortestPath: CPT401, CPT307,
CPT205, CPT201, CPT104, CPT102, CPT101. That chain is highlighted on the
graph. No lists to scan, the graph answers directly."

## Scene 4 - Path finder (0:52 to 1:12)

On screen: Path finder tab, choose CPT401, click Build my study path.
Scroll the ordered list slowly.

Say: "The Path finder goes further. Pick a target, and Pathway asks
Relate for every course reachable through prerequisite edges, then
orders them into a study sequence I can actually follow, 13 courses
where every prerequisite comes first."

## Scene 5 - Progress and persistence (1:12 to 1:30)

On screen: mark CPT101 and CPT102 as completed. Progress bar moves.
Reload the page. Progress is still there. Add CPT309 Web Development
with CPT204 as prerequisite.

Say: "When I mark a course as completed, that is a write into the graph.
Reload the page, and it is still here, because the store is persistent
in the browser. I can even add my own course, and every path answer
updates at once."

## Scene 6 - Under the hood and closing (1:30 to 1:45)

On screen: scroll to the Under the hood panel. Show the Relate version,
the OPFS store mode, and the last Cypher statement. Hold the final frame
for 2 seconds with a gentle fade.

Say: "Under the hood, this is Relate 1.3.0 in WebAssembly, no server, no
account, working offline. The repo also ships the same graph as a
single file store judges can inspect. Pathway: tell it where you want
to go, and the graph shows you the way. Thank you."

## Recording notes

- Start the recording with the app already loaded and seeded.
- Keep the cursor moving slowly enough to follow; click once per action.
- Feature labels, short, one per scene: "Course graph", "Shortest
  chain", "Study sequence", "Saved in the graph", "Relate in the
  browser".
- End on the Under the hood panel, not mid scroll.
