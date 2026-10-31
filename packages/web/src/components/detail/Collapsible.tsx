import { useId, useState, type ReactNode } from "react";

export function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="collapsible">
      <button type="button" className="collapse-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span> {label}
      </button>
      <div id={id} hidden={!open}>{children}</div>
    </div>
  );
}
