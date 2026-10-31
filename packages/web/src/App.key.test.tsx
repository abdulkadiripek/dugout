// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./screens/DetailScreen.js", () => ({
  DetailScreen: ({ id }: { id: string }) => {
    const [open, setOpen] = useState(false);
    return (
      <section>
        <h1>{id}</h1>
        <button type="button" aria-expanded={open} onClick={() => setOpen(true)}>toggle</button>
      </section>
    );
  },
}));

import { App } from "./App.js";

beforeEach(() => { vi.stubGlobal("scrollTo", vi.fn()); window.location.hash = "#/tasks/a"; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.location.hash = ""; });

describe("App detail route", () => {
  it("does not carry detail state over between task ids", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByRole("button", { name: "toggle" }).getAttribute("aria-expanded")).toBe("true");
    window.location.hash = "#/tasks/b";
    expect((await screen.findByRole("heading", { name: "b" })).textContent).toBe("b");
    expect(screen.getByRole("button", { name: "toggle" }).getAttribute("aria-expanded")).toBe("false");
  });
});
