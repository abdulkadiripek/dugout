import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "dugout-theme";

function readSaved(): Theme | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [saved, setSaved] = useState<Theme | null>(readSaved);
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (saved) document.documentElement.dataset.theme = saved;
    else delete document.documentElement.dataset.theme;
  }, [saved]);

  const theme = saved ?? system;
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setSaved(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // storage may be blocked; the choice then lasts for this session only
    }
  }, [theme]);

  return { theme, toggle };
}
