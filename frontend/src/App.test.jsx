import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { App } from "./App.jsx";

afterEach(cleanup);

const probe = { id: "new-probe", x: 0, y: 0, direction: "NORTH" };

test.each([true, false])("refreshes the list only on success (success: %s)", async (success) => {
  const launchResponse = success
    ? Response.json(probe, { status: 201 })
    : Response.json({ message: "Could not launch the probe." }, { status: 503 });
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ probes: [] }))
    .mockResolvedValueOnce(launchResponse)
    .mockResolvedValueOnce(Response.json({ probes: [probe] }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<App />);

  await screen.findByText("No probes launched.");
  await user.type(screen.getByRole("spinbutton", { name: "X limit" }), "5");
  await user.type(screen.getByRole("spinbutton", { name: "Y limit" }), "3");
  await user.click(screen.getByRole("button", { name: "Launch" }));

  if (success) {
    const table = await screen.findByRole("table");
    expect(within(table).getByText(probe.id)).toBeTruthy();
    expect(screen.getByText("Probe launched.")).toBeTruthy();
    expect(fetchMock.mock.calls[2][0]).toBe(fetchMock.mock.calls[0][0]);
  } else {
    expect((await screen.findByRole("alert")).textContent).toBe("Could not launch the probe.");
    expect(screen.getByText("No probes launched.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }
});
