import assert from "node:assert/strict";
import test from "node:test";
import { buildEducatorReport, buildLearnerDeadlines } from "../src/course_deadlines.ts";

test("a submitted assignment wins over overdue and the report counts each state", () => {
  const deadlines = buildLearnerDeadlines(
    [
      { id: "essay", title: "History essay", dueAt: "2026-09-22T12:00:00.000Z" },
      { id: "quiz", title: "Algebra quiz", dueAt: "2026-09-24T11:00:00.000Z" },
      { id: "lab", title: "Physics lab", dueAt: "2026-10-01T12:00:00.000Z" },
    ],
    [{ assignmentId: "essay", learnerId: "learner-7", submittedAt: "2026-09-22T13:00:00.000Z" }],
    "learner-7",
    new Date("2026-09-23T12:00:00.000Z"),
  );

  assert.deepEqual(
    deadlines.map(({ id, state }) => ({ id, state })),
    [
      { id: "essay", state: "submitted" },
      { id: "quiz", state: "due-soon" },
      { id: "lab", state: "open" },
    ],
  );
  assert.deepEqual(buildEducatorReport(deadlines), {
    submitted: 1,
    "due-soon": 1,
    overdue: 0,
    open: 1,
  });
});
