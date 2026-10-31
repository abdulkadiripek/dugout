import { useEffect, useRef } from "react";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { useRoute } from "./router.js";
import { DetailScreen } from "./screens/DetailScreen.js";
import { ListScreen } from "./screens/ListScreen.js";
import { NotFoundScreen } from "./screens/NotFoundScreen.js";
import { ScorecardScreen } from "./screens/ScorecardScreen.js";
import { useTheme } from "./theme.js";

const TITLES = { list: "Board", scorecard: "Scorecard", "not-found": "Not found" } as const;

export function App() {
  const route = useRoute();
  const { theme, toggle } = useTheme();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  const key = route.name === "task" ? `task:${route.id}` : route.name;

  useEffect(() => {
    document.title = `${route.name === "task" ? route.id : TITLES[route.name]} · Ajan Panosu`;
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo?.(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [key]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const target = ev.target instanceof HTMLElement ? ev.target : null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        target.blur();
        return;
      }
      if (window.location.hash !== "" && window.location.hash !== "#/") {
        window.location.hash = "#/";
        ev.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const listCurrent = route.name === "list" || route.name === "task";
  return (
    <>
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="8" cy="9" r="5" fill="var(--dot-passed)" />
            <circle cx="18" cy="9" r="5" fill="var(--dot-needs_review)" />
            <circle cx="13" cy="18" r="5" fill="var(--accent)" />
          </svg>
          Ajan Panosu
        </div>
        <nav aria-label="Main">
          <a href="#/" aria-current={listCurrent ? "page" : undefined}>Tasks</a>
          <a href="#/scorecard" aria-current={route.name === "scorecard" ? "page" : undefined}>Scorecard</a>
        </nav>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>
      <main id="app" tabIndex={-1} ref={mainRef}>
        {route.name === "list" ? <ListScreen /> : null}
        {route.name === "task" ? <DetailScreen key={route.id} id={route.id} /> : null}
        {route.name === "scorecard" ? <ScorecardScreen /> : null}
        {route.name === "not-found" ? <NotFoundScreen hash={route.hash} /> : null}
      </main>
    </>
  );
}
