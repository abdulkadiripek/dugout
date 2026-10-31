import type { Event } from "./events.js";

export function checkEventLog(events: readonly Event[]): string[] {
  const problems: string[] = [];
  if (events[0]?.type !== "task.created") {
    problems.push("First event must be task.created");
  }
  const finishes = events.filter((event) => event.type === "task.finished").length;
  if (finishes !== 1) {
    problems.push(`Expected exactly one task.finished, found ${finishes}`);
  }
  if (finishes > 0 && events.at(-1)?.type !== "task.finished") {
    problems.push("Last event must be task.finished");
  }
  const pending = new Set<number>();
  const started = new Set<number>();
  events.forEach((event, index) => {
    if (event.seq !== index) {
      problems.push(`Non-contiguous seq: expected ${index}, received ${event.seq}`);
    }
    if (event.type === "attempt.started") {
      if (started.has(event.attempt)) {
        problems.push(`Duplicate attempt.started for attempt ${event.attempt}`);
      }
      started.add(event.attempt);
      pending.add(event.attempt);
    }
    if (event.type === "attempt.finished" && !pending.delete(event.attempt)) {
      problems.push(`attempt.finished without matching attempt.started for attempt ${event.attempt}`);
    }
  });
  for (const attempt of pending) {
    problems.push(`attempt.started without matching attempt.finished for attempt ${attempt}`);
  }
  return problems;
}
