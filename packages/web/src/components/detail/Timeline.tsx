import type { Event } from "../../api.js";
import { deriveSteps, TONE_ICON } from "./derive.js";

const TONE_WORD = { ok: "ok", bad: "problem", warn: "attention", info: "info", mute: "info" } as const;

function jump(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  el.scrollIntoView?.({ block: "start", behavior: "smooth" });
  el.focus({ preventScroll: true });
}

export function Timeline({ events }: { events: readonly Event[] }) {
  const steps = deriveSteps(events);
  if (steps.length === 0) return null;
  return (
    <ol className="steps" aria-label="Timeline">
      {steps.map((s) => (
        <li key={s.key} className={`step ${s.tone}`}>
          <button type="button" className="step-btn" onClick={() => jump(s.target)}>
            <span className="node" aria-hidden="true">{TONE_ICON[s.tone]}</span>
            <span className="at">{s.at}</span>
            <span className="lab">{s.label}<span className="sr-only"> ({TONE_WORD[s.tone]})</span></span>
            <span className="tx" title={s.text}>{s.text}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
