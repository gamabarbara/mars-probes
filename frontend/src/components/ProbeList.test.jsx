import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { ProbeList } from "./ProbeList.jsx";

afterEach(cleanup);

const probes = Array.from({ length: 21 }, (_, index) => ({
  id: `sonda-${index + 1}`,
  x: index,
  y: 2,
  direction: "WEST",
}));

test("shows loading and then the empty list", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ probes: [] })));
  render(<ProbeList />);

  expect(screen.getByText("Carregando sondas…")).toBeTruthy();
  expect(await screen.findByText("Nenhuma sonda lançada.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Anterior" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Próxima" }).disabled).toBe(true);
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

  const table = await screen.findByRole("table", { name: "Sondas lançadas" });
  const firstRow = within(table).getByRole("row", { name: "sonda-1 (0, 2) Oeste" });
  expect(firstRow).toBeTruthy();
  expect(within(table).getAllByRole("row")).toHaveLength(21);
  expect(within(table).queryByText("sonda-21")).toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe("/probes?limit=21&offset=0&sort_by=id&order=asc");

  await user.click(screen.getByRole("button", { name: "Próxima" }));
  expect(await screen.findByText("sonda-21")).toBeTruthy();
  expect(screen.getByText("Página 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Próxima" }).disabled).toBe(true);
  expect(fetchMock.mock.calls[1][0]).toBe("/probes?limit=21&offset=20&sort_by=id&order=asc");

  await user.click(screen.getByRole("button", { name: "Anterior" }));
  expect(await screen.findByText("sonda-1")).toBeTruthy();
  expect(screen.getByText("Página 1")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Próxima" }));
  expect(await screen.findByText("sonda-21")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Ordenar por"), "x");
  expect(screen.getByText("Página 1")).toBeTruthy();
  expect(fetchMock.mock.calls[4][0]).toBe("/probes?limit=21&offset=0&sort_by=x&order=asc");
});

test("shows an API error and retries the same query", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ message: "Consulta indisponível." }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ probes: [probes[0]] }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ProbeList />);

  expect((await screen.findByRole("alert")).textContent).toBe("Consulta indisponível.");
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("sonda-1")).toBeTruthy();
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

  await user.selectOptions(screen.getByLabelText("Ordem"), "desc");
  expect(await screen.findByText("sonda-2")).toBeTruthy();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetchMock.mock.calls[1][0]).toBe("/probes?limit=21&offset=0&sort_by=id&order=desc");

  await act(async () => resolveFirst(Response.json({ probes: [probes[0]] })));
  expect(screen.queryByText("sonda-1")).toBeNull();
  expect(screen.getByText("sonda-2")).toBeTruthy();
});
