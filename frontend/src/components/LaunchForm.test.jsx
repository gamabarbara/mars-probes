import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { LaunchForm } from "./LaunchForm.jsx";

afterEach(cleanup);

async function submitLaunch() {
  const user = userEvent.setup();
  render(<LaunchForm />);
  await user.type(screen.getByRole("spinbutton", { name: "X limit" }), "5");
  await user.type(screen.getByRole("spinbutton", { name: "Y limit" }), "0");
  await user.selectOptions(screen.getByLabelText("Initial direction"), "EAST");
  await user.click(screen.getByRole("button", { name: "Launch" }));
}

test("launches a probe and shows the confirmed position", async () => {
  const probe = { id: "550e8400-e29b-41d4-a716-446655440000", x: 0, y: 0, direction: "EAST" };
  const fetchMock = vi.fn().mockResolvedValue(Response.json(probe, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);

  await submitLaunch();

  expect(fetchMock).toHaveBeenCalledWith("/probes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x: 5, y: 0, direction: "EAST" }),
  });
  const status = await screen.findByRole("status");
  expect(within(status).getByText(`ID: ${probe.id}`)).toBeTruthy();
  expect(within(status).getByText("Position: (0, 0) · Direction: East")).toBeTruthy();
});

test("shows the message returned by the API when launch fails", async () => {
  const message = "The database is busy. Try again in a moment.";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ code: "DATABASE_BUSY", message }, { status: 503 })),
  );

  await submitLaunch();

  expect((await screen.findByRole("alert")).textContent).toBe(message);
  expect(screen.queryByRole("status")).toBeNull();
});

test("shows grid validation in English and clears it when the value is corrected", async () => {
  const user = userEvent.setup();
  render(<LaunchForm />);
  const x = screen.getByRole("spinbutton", { name: "X limit" });

  await user.click(screen.getByRole("button", { name: "Launch" }));
  expect(x.validationMessage).toBe("Enter a whole number from 0 to 100.");

  await user.type(x, "5");
  expect(x.validity.valid).toBe(true);
});
