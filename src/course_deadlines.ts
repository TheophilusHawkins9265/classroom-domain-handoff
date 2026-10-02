export type Assignment = {
  id: string;
  title: string;
  dueAt: string;
};

export type Submission = {
  assignmentId: string;
  learnerId: string;
  submittedAt: string;
};

export type LearnerDeadline = Assignment & {
  state: "submitted" | "due-soon" | "overdue" | "open";
};

export function buildLearnerDeadlines(
  assignments: Assignment[],
  submissions: Submission[],
  learnerId: string,
  now: Date,
): LearnerDeadline[] {
  const submitted = new Set(
    submissions
      .filter((item) => item.learnerId === learnerId)
      .map((item) => item.assignmentId),
  );
  const soonBoundary = now.getTime() + 48 * 60 * 60 * 1_000;

  return assignments.map((assignment) => {
    const due = Date.parse(assignment.dueAt);
    const state = submitted.has(assignment.id)
      ? "submitted"
      : due < now.getTime()
        ? "overdue"
        : due <= soonBoundary
          ? "due-soon"
          : "open";
    return { ...assignment, state };
  });
}

export function buildEducatorReport(deadlines: LearnerDeadline[]) {
  return deadlines.reduce(
    (report, item) => {
      report[item.state] += 1;
      return report;
    },
    { submitted: 0, "due-soon": 0, overdue: 0, open: 0 },
  );
}
