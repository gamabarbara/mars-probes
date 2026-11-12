import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { MoveForm } from "./MoveForm.jsx";

afterEach(cleanup);

test.each(["", "m", "M M", "M\n", "M".repeat(1001)])(
  "rejects invalid commands without posting them",
  async (value) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MoveForm probeId="probe-1" onMovingChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Commands" }), { target: { value } });
    await user.click(screen.getByRole("button", { name: "Send commands" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Enter 1 to 1000 commands using only uppercase L, R, and M.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

const boundsMessage = "The command at step 3 would move the probe outside the grid.";

test.each([
  ["a rejected sequence", () => Response.json({ message: boundsMessage, step: 3 }, { status: 409 }), boundsMessage],
  ["an HTTP error without a message", () => new Response("Unavailable", { status: 503 }), "Could not move the probe."],
  ["a failed connection", () => { throw new TypeError("Failed to fetch"); }, "Could not confirm whether the probe moved."],
])("preserves commands after %s and clears feedback when switching probes", async (_, moveResponse, message) => {
  const fetchMock = vi.fn().mockImplementationOnce(moveResponse);
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  const { rerender } = render(<MoveForm key="probe-1" probeId="probe-1" onMovingChange={vi.fn()} />);
  await user.type(screen.getByRole("textbox", { name: "Commands" }), "RMM");
  await user.click(screen.getByRole("button", { name: "Send commands" }));

  expect((await screen.findByRole("alert")).textContent).toBe(message);
  expect(screen.getByRole("textbox", { name: "Commands" }).value).toBe("RMM");
  expect(screen.getByRole("button", { name: "Send commands" }).disabled).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  rerender(<MoveForm key="probe-2" probeId="probe-2" onMovingChange={vi.fn()} />);
  expect(screen.getByText("ID: probe-2")).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Commands" }).value).toBe("");
  expect(screen.queryByRole("alert")).toBeNull();
});
