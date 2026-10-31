import type { TaskStatus } from "../api.js";

export const STATUS_META: Record<TaskStatus, { label: string; icon: string }> = {
  passed: { label: "Passed", icon: "✓" },
  needs_review: { label: "Needs review", icon: "!" },
  failed: { label: "Failed", icon: "✕" },
  interrupted: { label: "Interrupted", icon: "…" },
  unreadable: { label: "Unreadable", icon: "?" },
};

export const STATUS_ORDER: TaskStatus[] = ["passed", "needs_review", "failed", "interrupted", "unreadable"];

export function StatusPill({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`pill ${status}`}>
      <i aria-hidden="true"><b>{meta.icon}</b></i>
      <span>{meta.label}</span>
    </span>
  );
}
