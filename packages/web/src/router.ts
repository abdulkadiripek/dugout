import { useSyncExternalStore } from "react";

export type Route =
  | { name: "list" }
  | { name: "task"; id: string }
  | { name: "scorecard" }
  | { name: "not-found"; hash: string };

export function parseHash(hash: string): Route {
  const path = (hash.replace(/^#/, "").split("?")[0] ?? "") || "/";
  if (path === "/") return { name: "list" };
  if (path === "/scorecard") return { name: "scorecard" };
  const match = /^\/tasks\/([A-Za-z0-9][A-Za-z0-9_-]*)$/.exec(path);
  if (match?.[1]) return { name: "task", id: match[1] };
  return { name: "not-found", hash };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const getHash = () => window.location.hash;

export function useHash(): string {
  return useSyncExternalStore(subscribe, getHash, () => "");
}

export function useRoute(): Route {
  return parseHash(useHash());
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}
