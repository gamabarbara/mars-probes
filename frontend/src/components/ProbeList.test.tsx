import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { ProbeList } from "./ProbeList";

afterEach(cleanup);

const probes = Array.from({ length: 21 }, (_, index) => ({
  id: `probe-${index + 1}`,
  x: index,
  y: 2,
  direction: "WEST",
}));

test("shows loading and then the empty list", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ probes: [] })));
  render(<ProbeList revision={0} selectedId={null} moving={false} onSelect={vi.fn()} />);

  expect(screen.getByText("Loading probes…")).toBeTruthy();
  expect(await screen.findByText("No probes launched.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Previous" }).matches(":disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Next" }).matches(":disabled")).toBe(true);
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
  render(<ProbeList revision={0} selectedId={null} moving={false} onSelect={vi.fn()} />);

  const table = await screen.findByRole("table", { name: "Probe fleet" });
  const firstRow = within(table).getByRole("row", { name: /probe-1 \(0, 2\) West/ });
  expect(firstRow).toBeTruthy();
  expect(within(table).getAllByRole("row")).toHaveLength(21);
  expect(within(table).queryByText("probe-21")).toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe("/probes?limit=21&offset=0&sort_by=id&order=asc");

  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("probe-21")).toBeTruthy();
  expect(screen.getByText("Page 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next" }).matches(":disabled")).toBe(true);
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
  render(<ProbeList revision={0} selectedId={null} moving={false} onSelect={vi.fn()} />);

  expect((await screen.findByRole("alert")).textContent).toBe("Probe listing is unavailable.");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("probe-1")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0]);
});

test("ignores an older response that arrives after the new ordering", async () => {
  let resolveFirst!: (response: Response) => void;
  const fetchMock = vi.fn()
    .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce(Response.json({ probes: [probes[1]] }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ProbeList revision={0} selectedId={null} moving={false} onSelect={vi.fn()} />);

  await user.selectOptions(screen.getByLabelText("Sort order"), "desc");
  expect(await screen.findByText("probe-2")).toBeTruthy();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetchMock.mock.calls[1][0]).toBe("/probes?limit=21&offset=0&sort_by=id&order=desc");

  await act(async () => resolveFirst(Response.json({ probes: [probes[0]] })));
  expect(screen.queryByText("probe-1")).toBeNull();
  expect(screen.getByText("probe-2")).toBeTruthy();
});
