import type { Theme } from "../theme.js";

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="theme" onClick={onToggle} aria-label={`Switch to ${next} theme`}>
      {theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}
