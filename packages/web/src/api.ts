import type { Event, ImplementerRow, ReviewerRow, Scorecard, TaskStatus, TaskSummary } from "@dugout/core";

export type { Event, ImplementerRow, ReviewerRow, Scorecard, TaskStatus, TaskSummary };

export type TaskDetail = { summary: TaskSummary; events: Event[] };
export type DiffResult = { diff: string; truncated: boolean; bytes: number };

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;
    try {
      const body: unknown = await res.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // body was not JSON; keep the status text
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export async function getTasks(opts: { limit?: number; status?: TaskStatus } = {}): Promise<TaskSummary[]> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.status !== undefined) params.set("status", opts.status);
  const query = params.toString();
  const body = await request<{ tasks: TaskSummary[] }>(`/api/tasks${query ? `?${query}` : ""}`);
  return body.tasks;
}

export function getTask(id: string): Promise<TaskDetail> {
  return request<TaskDetail>(`/api/tasks/${encodeURIComponent(id)}`);
}

export function getDiff(id: string): Promise<DiffResult> {
  return request<DiffResult>(`/api/tasks/${encodeURIComponent(id)}/diff`);
}

export function getScorecard(): Promise<Scorecard> {
  return request<Scorecard>("/api/scorecard");
}
