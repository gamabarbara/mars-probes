import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { ProbeList } from "./ProbeList.jsx";

afterEach(cleanup);

const probes = Array.from({ length: 21 }, (_, index) => ({
  id: `probe-${index + 1}`,
  x: index,
  y: 2,
  direction: "WEST",
}));

test("shows loading and then the empty list", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ probes: [] })));
  render(<ProbeList />);

  expect(screen.getByText("Loading probes…")).toBeTruthy();
  expect(await screen.findByText("No probes launched.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Previous" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Next" }).disabled).toBe(true);
});

test("pages through results and resets the offset when sorting changes", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ probes }))
    .mockResolvedValueOnce(Response.json({ probes: probes.slice(20) }))
    .mockResolvedValueOnce(Response.json({ probes }))
    .mockResolvedValueOnce(Response.json({ probes: probes.slice(20) }))
    .mockResolvedValueOnce(Response.json({ probes: [...probes].reverse() }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ProbeList />);

  const table = await screen.findByRole("table", { name: "Launched probes" });
  const firstRow = within(table).getByRole("row", { name: /probe-1 \(0, 2\) West/ });
  expect(firstRow).toBeTruthy();
  expect(within(table).getAllByRole("row")).toHaveLength(21);
  expect(within(table).queryByText("probe-21")).toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe("/probes?limit=21&offset=0&sort_by=id&order=asc");

  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("probe-21")).toBeTruthy();
  expect(screen.getByText("Page 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next" }).disabled).toBe(true);
  expect(fetchMock.mock.calls[1][0]).toBe("/probes?limit=21&offset=20&sort_by=id&order=asc");

  await user.click(screen.getByRole("button", { name: "Previous" }));
  expect(await screen.findByText("probe-1")).toBeTruthy();
  expect(screen.getByText("Page 1")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("probe-21")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Sort by"), "x");
  expect(screen.getByText("Page 1")).toBeTruthy();
  expect(fetchMock.mock.calls[4][0]).toBe("/probes?limit=21&offset=0&sort_by=x&order=asc");
});

test("shows an API error and retries the same query", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ message: "Probe listing is unavailable." }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ probes: [probes[0]] }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ProbeList />);

  expect((await screen.findByRole("alert")).textContent).toBe("Probe listing is unavailable.");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("probe-1")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0]);
});

test("ignores an older response that arrives after the new ordering", async () => {
  let resolveFirst;
  const fetchMock = vi.fn()
    .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce(Response.json({ probes: [probes[1]] }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ProbeList />);

  await user.selectOptions(screen.getByLabelText("Sort order"), "desc");
  expect(await screen.findByText("probe-2")).toBeTruthy();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetchMock.mock.calls[1][0]).toBe("/probes?limit=21&offset=0&sort_by=id&order=desc");

  await act(async () => resolveFirst(Response.json({ probes: [probes[0]] })));
  expect(screen.queryByText("probe-1")).toBeNull();
  expect(screen.getByText("probe-2")).toBeTruthy();
});

test("moves the selected probe once and refreshes the same page and sorting", async () => {
  const selected = probes[20];
  const other = { ...selected, id: "probe-22", x: 21 };
  let resolveMove;
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ probes }))
    .mockResolvedValueOnce(Response.json({ probes }))
    .mockResolvedValueOnce(Response.json({ probes: [selected, other] }))
    .mockReturnValueOnce(new Promise((resolve) => { resolveMove = resolve; }))
    .mockResolvedValueOnce(Response.json({ probes: [probes[19], other] }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ProbeList />);

  await screen.findByRole("table");
  await user.selectOptions(screen.getByLabelText("Sort by"), "x");
  await screen.findByRole("table");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(await screen.findByRole("button", { name: "Move probe probe-21" }));

  const form = screen.getByRole("form", { name: "Move probe" });
  const commands = within(form).getByRole("textbox", { name: "Commands" });
  await user.type(commands, "MRM");
  await user.click(within(form).getByRole("button", { name: "Send commands" }));
  const pending = within(form).getByRole("button", { name: "Sending…" });
  const switchProbe = screen.getByRole("button", { name: "Move probe probe-22" });
  expect(pending.disabled).toBe(true);
  expect(switchProbe.disabled).toBe(true);
  await user.click(pending);
  await user.click(switchProbe);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(fetchMock).toHaveBeenNthCalledWith(4, "/probes/probe-21/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: "MRM" }),
  });

  await act(async () => resolveMove(Response.json({
    id: selected.id, x: 19, y: 3, direction: "NORTH",
  })));

  expect(within(form).getByRole("status").textContent).toContain("Position: (19, 3) · Direction: North");
  expect(within(form).getByText("ID: probe-21")).toBeTruthy();
  expect(commands.value).toBe("");
  const table = await screen.findByRole("table");
  expect(within(table).queryByText("probe-21")).toBeNull();
  expect(screen.getByText("Page 2")).toBeTruthy();
  expect(fetchMock.mock.calls[4][0]).toBe("/probes?limit=21&offset=20&sort_by=x&order=asc");
});

test.each(["", "m", "M M", "M\n", "M".repeat(1001)])(
  "rejects invalid commands without posting them",
  async (value) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ probes: [probes[0]] }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ProbeList />);

    await user.click(await screen.findByRole("button", { name: "Move probe probe-1" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Commands" }), { target: { value } });
    await user.click(screen.getByRole("button", { name: "Send commands" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Enter 1 to 1000 commands using only uppercase L, R, and M.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

const boundsMessage = "The command at step 3 would move the probe outside the grid.";

test.each([
  ["a rejected sequence", () => Response.json({ message: boundsMessage, step: 3 }, { status: 409 }), boundsMessage],
  ["an HTTP error without a message", () => new Response("Unavailable", { status: 503 }), "Could not move the probe."],
  ["a failed connection", () => { throw new TypeError("Failed to fetch"); }, "Could not confirm whether the probe moved."],
])("preserves commands after %s and clears feedback when switching probes", async (_, moveResponse, message) => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ probes: probes.slice(0, 2) }))
    .mockImplementationOnce(moveResponse);
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ProbeList />);

  await user.click(await screen.findByRole("button", { name: "Move probe probe-1" }));
  await user.type(screen.getByRole("textbox", { name: "Commands" }), "RMM");
  await user.click(screen.getByRole("button", { name: "Send commands" }));

  expect((await screen.findByRole("alert")).textContent).toBe(message);
  expect(screen.getByRole("textbox", { name: "Commands" }).value).toBe("RMM");
  expect(screen.getByRole("button", { name: "Send commands" }).disabled).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(2);

  await user.click(screen.getByRole("button", { name: "Move probe probe-2" }));
  expect(screen.getByText("ID: probe-2")).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Commands" }).value).toBe("");
  expect(screen.queryByRole("alert")).toBeNull();
});
