import type { Event } from "./events.js";

const fields = [
  "type", "attempt", "reason", "provider", "status", "exitReason", "from", "to",
  "passed", "exitCode", "verdict", "attempts", "providers",
] as const;

export function structurallyEqual(left: readonly Event[], right: readonly Event[]): boolean {
  const project = (events: readonly Event[]) => events
    .filter((event) => !["provider.tool", "provider.message", "provider.usage"].includes(event.type))
    .map((event) => {
      const values: Record<string, unknown> = {
        ...event, verdict: event.type === "review.finished" ? event.result.verdict : undefined,
      };
      return fields.map((field) => values[field]);
    });
  return JSON.stringify(project(left)) === JSON.stringify(project(right));
}
