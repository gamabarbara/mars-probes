import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { App } from "./App";
import type { Probe } from "./probeTypes";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const first: Probe = { id: "probe-1", x: 0, y: 0, direction: "NORTH" };
const second: Probe = { ...first, id: "probe-2", direction: "WEST" };
const firstDetail = { ...first, max_x: 3, max_y: 5 };
const secondDetail = { ...second, max_x: 7, max_y: 2 };
const firstMapPage = "/probes?limit=100&offset=0";

type MockRequest = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };
type MockHandler = (url: string, options: MockRequest) => Response | Promise<Response> | undefined;

function mockApi(probes: Probe[], handle: MockHandler = () => undefined) {
  const fetchMock = vi.fn(async (url: string, options: MockRequest) => {
    const response = handle(url, options);
    if (response !== undefined) return response;
    if (url.startsWith("/probes?")) {
      const query = new URLSearchParams(url.split("?")[1]);
      const offset = Number(query.get("offset"));
      return Response.json({ probes: probes.slice(offset, offset + Number(query.get("limit"))) });
    }
    if (url === "/probes/probe-1") return Response.json(firstDetail);
    if (url === "/probes/probe-2") return Response.json(secondDetail);
    throw new Error("Unexpected request " + url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function selectProbe(user: ReturnType<typeof userEvent.setup>, id: string) {
  return user.click(screen.getByRole("button", { name: "Select probe " + id }));
}

test.each([true, false])("refreshes the table and map only after a successful launch (%s)", async (success) => {
  const probes: Probe[] = [];
  const fetchMock = mockApi(probes, (url, options) => {
    if (url !== "/probes" || options?.method !== "POST") return;
    if (!success) return Response.json({ message: "Could not launch the probe." }, { status: 503 });
    probes.push(first);
    return Response.json(first, { status: 201 });
  });
  const user = userEvent.setup();
  render(<App />);

  await screen.findByText("No probes launched.");
  expect(screen.getByText("No probes to display.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Launch probe" }));
  const dialog = within(screen.getByRole("dialog", { name: "Launch probe" }));
  const x = dialog.getByRole<HTMLInputElement>("spinbutton", { name: "X limit" });
  await user.type(x, "5");
  await user.type(dialog.getByRole("spinbutton", { name: "Y limit" }), "3");
  await user.click(dialog.getByRole("button", { name: "Launch" }));

  if (success) {
    const table = await screen.findByRole("table");
    expect(within(table).getByText(first.id)).toBeTruthy();
    expect(await screen.findByText("Cell (0, 0): 1 probe, selected probe facing North")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select probe probe-1" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Probe launched.")).toBeTruthy();
  } else {
    expect((await dialog.findByRole("alert")).textContent).toBe("Could not launch the probe.");
    expect(x.value).toBe("5");
    expect(screen.getByText("No probes launched.")).toBeTruthy();
    expect(screen.getByText("No probes to display.")).toBeTruthy();
  }

  const reads = fetchMock.mock.calls.filter(([, options]) => options.method !== "POST");
  expect(reads).toHaveLength(success ? 5 : 2);
});

test("cycles through probes sharing a map cell by ID and keeps keyboard focus", async () => {
  mockApi([second, first]);
  const user = userEvent.setup();
  render(<App />);

  const map = within(await screen.findByRole("region", { name: "Map grid" }));
  const marker = map.getByRole("button", { name: /Cell \(0, 0\): 2 probes.*Select probe probe-1/ });
  marker.focus();
  await user.keyboard("{Enter}");
  await screen.findByText("ID: probe-1");
  expect(screen.getByRole("button", { name: "Select probe probe-1" }).getAttribute("aria-pressed")).toBe("true");
  expect(document.activeElement).toBe(marker);
  await user.keyboard(" ");
  expect(await screen.findByText("ID: probe-2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Select probe probe-2" }).getAttribute("aria-pressed")).toBe("true");
  await user.keyboard("{Enter}");
  expect(await screen.findByText("ID: probe-1")).toBeTruthy();
});

test("maps probes from every page and keeps selection when paging or sorting", async () => {
  const probes = [first, second, ...Array.from({ length: 98 }, (_, i) => ({
    ...first, id: "additional-" + i, x: 2, y: 2,
  })), { ...first, id: "last-probe", x: 8, y: 1 }];
  const fetchMock = mockApi(probes);
  const user = userEvent.setup();
  render(<App />);

  const table = await screen.findByRole("table");
  expect(within(table).queryByText("last-probe")).toBeNull();
  const overlap = await screen.findByText("Cell (0, 0): 2 probes");
  expect(overlap.closest("[role=listitem]")?.querySelector(".marker-glyph")?.textContent).toBe("2");
  expect(screen.getByText("Cell (8, 1): 1 probe")).toBeTruthy();
  expect(screen.getByText("Map bounds: (0, 0) to (8, 2)")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith("/probes?limit=100&offset=100", expect.anything());

  await selectProbe(user, first.id);
  expect(await screen.findByText("Cell (0, 0): 2 probes, selected probe facing North")).toBeTruthy();
  expect(screen.getByText("Map bounds: (0, 0) to (8, 5)")).toBeTruthy();
  expect(screen.getByText("(0, 0) to (3, 5)")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Select probe probe-1" }).getAttribute("aria-pressed")).toBe("true");

  fetchMock.mockClear();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("additional-18")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Sort by"), "x");
  await screen.findByRole("button", { name: "Select probe probe-1" });
  expect(screen.getByText("Cell (0, 0): 2 probes, selected probe facing North")).toBeTruthy();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/probes?limit=21&offset=20&sort_by=id&order=asc",
    "/probes?limit=21&offset=0&sort_by=x&order=asc",
  ]);

  await user.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(screen.getByText("Map bounds: (0, 0) to (8, 2)")).toBeTruthy();
  expect(screen.queryByRole("form", { name: "Move probe" })).toBeNull();
  expect(screen.getByText("Cell (0, 0): 2 probes")).toBeTruthy();
});

test("ignores detail responses superseded by another selection or by clearing it", async () => {
  const pending: { resolve: (response: Response) => void; signal: MockRequest["signal"] }[] = [];
  mockApi([first, second], (url, { signal }) => {
    if (url !== "/probes/probe-1") return;
    return new Promise<Response>((resolve) => pending.push({ resolve, signal }));
  });
  const user = userEvent.setup();
  render(<App />);

  await screen.findByRole("table");
  await selectProbe(user, first.id);
  expect(screen.getByText("Loading selected probe…")).toBeTruthy();
  await selectProbe(user, second.id);
  expect(await screen.findByText("Cell (0, 0): 2 probes, selected probe facing West")).toBeTruthy();
  expect(pending[0].signal?.aborted).toBe(true);
  await act(async () => pending[0].resolve(Response.json(firstDetail)));
  expect(screen.getByText("(0, 0) to (7, 2)")).toBeTruthy();

  await selectProbe(user, first.id);
  expect(screen.getByText("Cell (0, 0): 2 probes")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(pending[1].signal?.aborted).toBe(true);
  await act(async () => pending[1].resolve(Response.json(firstDetail)));
  expect(screen.queryByText("Selected probe", { selector: "h3" })).toBeNull();
  expect(screen.getByText("Cell (0, 0): 2 probes")).toBeTruthy();
});

test("retries map and detail independently and keeps the overview after detail failure", async () => {
  let mapReads = 0;
  let detailReads = 0;
  const fetchMock = mockApi([first, second], (url) => {
    if (url === firstMapPage && ++mapReads === 1) {
      return Response.json({ message: "Map unavailable." }, { status: 503 });
    }
    if (url === "/probes/probe-1" && ++detailReads === 1) {
      return Response.json({ message: "Probe not found." }, { status: 404 });
    }
  });
  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByText("Map unavailable.")).toBeTruthy();
  fetchMock.mockClear();
  await user.click(screen.getByRole("button", { name: "Retry map" }));
  expect(await screen.findByText("Cell (0, 0): 2 probes")).toBeTruthy();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([firstMapPage]);

  await selectProbe(user, second.id);
  expect(await screen.findByText("Cell (0, 0): 2 probes, selected probe facing West")).toBeTruthy();
  await selectProbe(user, first.id);
  expect(await screen.findByText("Probe not found.")).toBeTruthy();
  expect(screen.getByText("Cell (0, 0): 2 probes")).toBeTruthy();

  fetchMock.mockClear();
  await user.click(screen.getByRole("button", { name: "Retry detail" }));
  expect(await screen.findByText("Cell (0, 0): 2 probes, selected probe facing North")).toBeTruthy();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/probes/probe-1"]);
});

test("refreshes the same page and highlights the confirmed position without double counting", async () => {
  const probes = [first, second, ...Array.from({ length: 19 }, (_, i) => ({
    ...first, id: "additional-" + i, x: 2, y: 2,
  }))];
  const moved = { ...first, x: 1, y: 1, direction: "EAST" };
  let resolveMove!: (response: Response) => void;
  let confirmed = false;
  const fetchMock = mockApi(probes, (url) => {
    if (url === "/probes/probe-1/commands") {
      return new Promise<Response>((resolve) => { resolveMove = resolve; });
    }
    if (confirmed && url === "/probes/probe-1") return Response.json({ ...firstDetail, ...moved });
    if (confirmed && url.startsWith("/probes?limit=21&")) return Response.json({ probes: probes.slice(-1) });
  });
  const user = userEvent.setup();
  render(<App />);

  await screen.findByRole("table");
  await user.selectOptions(screen.getByLabelText("Sort by"), "x");
  await screen.findByRole("table");
  await selectProbe(user, first.id);
  expect(await screen.findByText("Cell (0, 0): 2 probes, selected probe facing North")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("button", { name: "Select probe additional-18" });

  fetchMock.mockClear();
  const form = screen.getByRole("form", { name: "Move probe" });
  const commands = within(form).getByRole<HTMLTextAreaElement>("textbox", { name: "Commands" });
  await user.click(within(form).getByRole("button", { name: "M Move" }));
  await user.click(within(form).getByRole("button", { name: "R Right" }));
  await user.click(within(form).getByRole("button", { name: "M Move" }));
  expect(commands.value).toBe("MRM");
  await user.click(within(form).getByRole("button", { name: "Send commands" }));
  const pending = within(form).getByRole("button", { name: "Sending…" });
  const switchProbe = screen.getByRole("button", { name: "Select probe additional-18" });
  const clear = screen.getByRole("button", { name: "Clear selection" });
  const map = within(screen.getByRole("region", { name: "Map grid" }));
  expect([pending, switchProbe, clear, screen.getByRole("button", { name: "Launch probe" }),
    ...map.getAllByRole("button")].every((button) => button.matches(":disabled"))).toBe(true);
  await user.click(pending);
  await user.click(switchProbe);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/probes/probe-1/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": expect.any(String) },
    body: JSON.stringify({ commands: "MRM" }),
  });

  confirmed = true;
  await act(async () => resolveMove(Response.json(moved)));
  expect(within(form).getByRole("status").textContent).toContain("Position: (1, 1) · Direction: East");
  expect(screen.getByText("ID: probe-1")).toBeTruthy();
  expect(commands.value).toBe("");
  expect(screen.getByText("Page 2")).toBeTruthy();
  expect(await screen.findByText("Cell (1, 1): 1 probe, selected probe facing East")).toBeTruthy();
  expect(screen.getByText("Cell (0, 0): 1 probe")).toBeTruthy();
  expect(fetchMock.mock.calls.slice(1).map(([url]) => url).sort()).toEqual([
    "/probes/probe-1",
    firstMapPage,
    "/probes?limit=21&offset=20&sort_by=x&order=asc",
  ]);
});

test("refreshes after a lost move response and retries the same move after remount", async () => {
  const probes = [first];
  const confirmedMoves = new Map();
  let resolveDetail: ((response: Response) => void) | undefined;
  const fetchMock = mockApi(probes, (url, options) => {
    if (url === "/probes/probe-1") {
      if (probes[0].y === 1 && !resolveDetail) {
        return new Promise<Response>((resolve) => { resolveDetail = resolve; });
      }
      return Response.json({ ...firstDetail, ...probes[0] });
    }
    if (url !== "/probes/probe-1/commands" || options?.method !== "POST") return;

    const key = options.headers?.["Idempotency-Key"];
    if (!key) throw new Error("Missing idempotency key");
    if (confirmedMoves.has(key)) return Response.json(confirmedMoves.get(key));
    const moved = { ...probes[0], y: probes[0].y + 1 };
    probes[0] = moved;
    confirmedMoves.set(key, moved);
    if (moved.y === 1) throw new TypeError("Failed to fetch");
    return Response.json(moved);
  });
  const user = userEvent.setup();
  const { unmount } = render(<App />);

  await screen.findByRole("table");
  await selectProbe(user, first.id);
  await screen.findByText("Cell (0, 0): 1 probe, selected probe facing North");
  const form = screen.getByRole("form", { name: "Move probe" });
  const commands = within(form).getByRole<HTMLTextAreaElement>("textbox", { name: "Commands" });
  await user.type(commands, "M");
  await user.click(within(form).getByRole("button", { name: "Send commands" }));

  expect((await within(form).findByRole("alert")).textContent).toBe("Could not confirm whether the probe moved.");
  expect(within(form).getByRole("button", { name: "Retry move" }).matches(":disabled")).toBe(true);
  expect(commands.disabled).toBe(true);
  const completeDetail = resolveDetail;
  if (!completeDetail) throw new Error("Expected a pending detail request");
  await act(async () => completeDetail(Response.json({ ...firstDetail, ...probes[0] })));
  await screen.findByText("Cell (0, 1): 1 probe, selected probe facing North");
  expect(within(form).getByRole("button", { name: "Retry move" }).matches(":disabled")).toBe(false);

  unmount();
  render(<App />);
  await screen.findByRole("table");
  await selectProbe(user, first.id);
  await screen.findByText("Cell (0, 1): 1 probe, selected probe facing North");
  const restoredForm = screen.getByRole("form", { name: "Move probe" });
  const restoredCommands = within(restoredForm).getByRole<HTMLTextAreaElement>("textbox", { name: "Commands" });
  expect(restoredCommands.value).toBe("M");
  await user.click(within(restoredForm).getByRole("button", { name: "Retry move" }));
  expect((await within(restoredForm).findByRole("status")).textContent).toContain("Position: (0, 1)");
  await screen.findByText("Cell (0, 1): 1 probe, selected probe facing North");
  expect(restoredCommands.value).toBe("");

  await user.type(restoredCommands, "M");
  await user.click(within(restoredForm).getByRole("button", { name: "Send commands" }));
  expect(await screen.findByText("Cell (0, 2): 1 probe, selected probe facing North")).toBeTruthy();
  const attempts = fetchMock.mock.calls
    .filter(([url, options]) => url === "/probes/probe-1/commands" && options?.method === "POST")
    .map(([, options]) => ({
      key: options.headers?.["Idempotency-Key"],
      commands: JSON.parse(String(options.body)).commands,
    }));
  expect(attempts.map(({ commands }) => commands)).toEqual(["M", "M", "M"]);
  expect(attempts[0].key).toEqual(expect.any(String));
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[2].key).toEqual(expect.any(String));
  expect(attempts[2].key).not.toBe(attempts[0].key);
});
