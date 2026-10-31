globalThis.Board = (() => {
  const DATA = JSON.parse(document.getElementById("board-data").textContent);
  const STATUS = {
    passed: { label: "Passed", icon: "✓" },
    needs_review: { label: "Needs review", icon: "!" },
    failed: { label: "Failed", icon: "✕" },
    interrupted: { label: "Interrupted", icon: "…" },
    unreadable: { label: "Unreadable", icon: "?" },
  };
  const STATUS_ORDER = ["passed", "needs_review", "failed", "interrupted", "unreadable"];
  const state = { status: "all", provider: "all" };
  let views = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const ms = (value) => {
    if (value === null || value === undefined) return "—";
    if (value < 1000) return Math.round(value) + "ms";
    const s = value / 1000;
    if (s < 60) return (s < 10 ? s.toFixed(1) : Math.round(s)) + "s";
    const m = Math.floor(s / 60);
    const rest = Math.round(s - m * 60);
    if (m < 60) return m + "m " + String(rest).padStart(2, "0") + "s";
    return Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";
  };
  const num = (value) => {
    if (value >= 10000) return (value / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return value.toLocaleString("en-US");
  };
  const tokens = (t) => ({ input: num(t.input), output: num(t.output), total: num(t.input + t.output) });
  const pct = (value) => Math.round(value * 100) + "%";
  const dec = (value) => (Math.round(value * 100) / 100).toString();
  const date = (iso) => (iso ? iso.slice(0, 10) : "—");
  const dateTime = (iso) => (iso ? iso.slice(0, 10) + " " + iso.slice(11, 16) + " UTC" : "—");
  const offset = (iso, start) => {
    const d = Date.parse(iso) - Date.parse(start);
    if (!(d >= 0)) return "+0s";
    if (d < 1000) return "+" + Math.round(d) + "ms";
    return "+" + ms(d).replace(/ /g, "");
  };

  const allTasks = () => DATA.tasks;
  const findTask = (id) => DATA.tasks.find((t) => t.summary.taskId === id);
  const providersAll = () => [...new Set(DATA.tasks.flatMap((t) => t.summary.providers))].sort();
  const statusCounts = () => {
    const counts = { all: DATA.tasks.length };
    for (const s of STATUS_ORDER) counts[s] = DATA.tasks.filter((t) => t.summary.status === s).length;
    return counts;
  };
  const filtered = () => DATA.tasks.filter((t) =>
    (state.status === "all" || t.summary.status === state.status) &&
    (state.provider === "all" || t.summary.providers.includes(state.provider)));

  const attemptsOf = (events) => {
    const list = [];
    const byN = new Map();
    for (const e of events) {
      if (e.type === "attempt.started") {
        const a = { n: e.attempt, provider: e.provider, model: e.model, reason: e.reason, status: null,
          exitReason: null, durationMs: null, input: 0, output: 0, verify: null, tools: [], messages: [], startTs: e.ts };
        byN.set(e.attempt, a);
        list.push(a);
      } else if ("attempt" in e && byN.has(e.attempt)) {
        const a = byN.get(e.attempt);
        if (e.type === "attempt.finished") { a.status = e.status; a.exitReason = e.exitReason; a.durationMs = e.durationMs; }
        else if (e.type === "provider.usage") { a.input += e.inputTokens ?? 0; a.output += e.outputTokens ?? 0; }
        else if (e.type === "verify.started") a.verify = { command: e.command, passed: null, exitCode: null, durationMs: null, outputTail: "" };
        else if (e.type === "verify.finished") a.verify = { ...(a.verify ?? { command: "" }), passed: e.passed, exitCode: e.exitCode, durationMs: e.durationMs, outputTail: e.outputTail };
        else if (e.type === "provider.tool") a.tools.push(e);
        else if (e.type === "provider.message") a.messages.push(e);
      }
    }
    return list;
  };
  const reviewOf = (events) => events.findLast((e) => e.type === "review.finished") ?? null;
  const setupOf = (events) => events.find((e) => e.type === "setup.finished") ?? null;
  const finishOf = (events) => events.findLast((e) => e.type === "task.finished") ?? null;

  const describe = (e, start) => {
    const at = offset(e.ts, start);
    const base = { at, type: e.type, attempt: e.attempt ?? null };
    switch (e.type) {
      case "task.created": return { ...base, label: "Task created", text: e.package.goal, tone: "info" };
      case "worktree.created": return { ...base, label: "Worktree", text: e.branch + " from " + e.baseRef, tone: "mute" };
      case "setup.finished": return { ...base, label: "Setup " + (e.passed ? "passed" : "failed"), text: "exit " + e.exitCode + " in " + ms(e.durationMs) + (e.outputTail ? " · " + e.outputTail : ""), tone: e.passed ? "ok" : "bad" };
      case "attempt.started": return { ...base, label: "Attempt " + e.attempt + " started", text: e.provider + " · " + e.model + " · " + e.reason, tone: "info" };
      case "provider.tool": return { ...base, label: "Tool " + e.name, text: e.summary, tone: "mute" };
      case "provider.message": return { ...base, label: "Message", text: e.text, tone: "mute" };
      case "provider.usage": return { ...base, label: "Usage", text: num(e.inputTokens ?? 0) + " in / " + num(e.outputTokens ?? 0) + " out", tone: "mute" };
      case "attempt.finished": return { ...base, label: "Attempt " + e.attempt + " " + e.status, text: e.exitReason + " · " + ms(e.durationMs), tone: e.status === "completed" ? "ok" : "bad" };
      case "fallback.triggered": return { ...base, label: "Fallback", text: e.from + " → " + e.to + " (" + e.reason + ")", tone: "warn" };
      case "verify.started": return { ...base, label: "Verify started", text: e.command, tone: "mute" };
      case "verify.finished": return { ...base, label: "Verify " + (e.passed ? "passed" : "failed"), text: "exit " + e.exitCode + " in " + ms(e.durationMs), tone: e.passed ? "ok" : "bad" };
      case "review.started": return { ...base, label: "Review started", text: e.provider + " · " + e.model, tone: "info" };
      case "review.finished": return { ...base, label: "Review " + e.result.verdict.replace("_", " "), text: e.result.issues.length + " issue" + (e.result.issues.length === 1 ? "" : "s"), tone: e.result.verdict === "approve" ? "ok" : "warn" };
      case "task.finished": return { ...base, label: "Task " + e.status.replace("_", " "), text: e.attempts + " attempt" + (e.attempts === 1 ? "" : "s") + " · " + e.diffStat.files + " files +" + e.diffStat.additions + " −" + e.diffStat.deletions + " · " + ms(e.durationMs), tone: e.status === "passed" ? "ok" : e.status === "failed" ? "bad" : "warn" };
      default: return { ...base, label: e.type, text: "", tone: "mute" };
    }
  };

  const route = () => {
    const h = location.hash.replace(/^#/, "") || "/";
    if (h === "/scorecard") return { name: "scorecard" };
    const m = /^\/tasks\/([A-Za-z0-9][A-Za-z0-9_-]*)$/.exec(h);
    if (m) return { name: "detail", id: m[1] };
    return { name: "list" };
  };

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("dugout-proto-theme", theme); } catch { /* storage may be blocked */ }
    syncToggle();
  };
  const effectiveTheme = () => document.documentElement.dataset.theme ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const syncToggle = () => {
    const t = effectiveTheme();
    for (const b of document.querySelectorAll("[data-theme-toggle]")) {
      b.textContent = t === "dark" ? "Light theme" : "Dark theme";
      b.setAttribute("aria-label", "Switch to " + (t === "dark" ? "light" : "dark") + " theme");
    }
  };

  const render = (focusSel) => {
    const r = route();
    const app = document.getElementById("app");
    let html;
    let title = "Board";
    if (r.name === "detail") {
      const task = findTask(r.id);
      html = task ? views.detail(task) : views.missing(r.id);
      title = r.id;
    } else if (r.name === "scorecard") { html = views.scorecard(DATA.scorecard); title = "Scorecard"; }
    else html = views.list();
    app.innerHTML = html;
    document.title = title + " · Dugout";
    for (const a of document.querySelectorAll("[data-nav]")) {
      const on = (a.dataset.nav === "scorecard") === (r.name === "scorecard");
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    }
    syncToggle();
    if (focusSel) { const el = app.querySelector(focusSel); if (el) el.focus(); }
    else if (r.name !== "list" || state.fromRoute) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
    state.fromRoute = true;
  };

  const rows = () => [...document.querySelectorAll("[data-row]")];
  const onKey = (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const tag = ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") { if (ev.key === "Escape") ev.target.blur(); return; }
    const r = route();
    if (ev.key === "Escape") {
      if (r.name !== "list") { location.hash = "#/"; ev.preventDefault(); }
      return;
    }
    if (r.name !== "list") return;
    const list = rows();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    if (ev.key === "j" || ev.key === "ArrowDown") { list[Math.min(i + 1, list.length - 1)].focus(); ev.preventDefault(); }
    else if (ev.key === "k" || ev.key === "ArrowUp") { list[Math.max(i - 1, 0)].focus(); ev.preventDefault(); }
    else if (ev.key === "Enter" && i < 0) { list[0].click(); ev.preventDefault(); }
  };

  const onClick = (ev) => {
    const t = ev.target.closest("[data-theme-toggle], [data-set-status], [data-set-provider]");
    if (!t) return;
    if (t.hasAttribute("data-theme-toggle")) { setTheme(effectiveTheme() === "dark" ? "light" : "dark"); return; }
    if (t.dataset.setStatus !== undefined) state.status = t.dataset.setStatus;
    if (t.dataset.setProvider !== undefined) state.provider = t.dataset.setProvider;
    const sel = t.dataset.setStatus !== undefined ? '[data-set-status="' + t.dataset.setStatus + '"]' : '[data-set-provider="' + t.dataset.setProvider + '"]';
    render(sel);
  };

  const start = (v) => {
    views = v;
    try {
      const saved = localStorage.getItem("dugout-proto-theme");
      if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
    } catch { /* storage may be blocked */ }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    addEventListener("hashchange", () => render());
    render();
  };

  return { STATUS, STATUS_ORDER, state, esc, ms, num, tokens, pct, dec, date, dateTime, offset, allTasks, findTask,
    providersAll, statusCounts, filtered, attemptsOf, reviewOf, setupOf, finishOf, describe, start };
})();
