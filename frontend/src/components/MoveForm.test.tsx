import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { MoveForm } from "./MoveForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

test.each(["", "m", "M M", "M\n", "M".repeat(1001)])(
  "rejects invalid commands without posting them",
  async (value) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MoveForm probeId="probe-1" onMovingChange={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.change(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Commands" }), { target: { value } });
    await user.click(screen.getByRole("button", { name: "Send commands" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Enter 1 to 1000 commands using only uppercase L, R, and M.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

const boundsMessage = "The command at step 3 would move the probe outside the grid.";

test.each([
  ["a rejected sequence", () => Response.json({ message: boundsMessage, step: 3 }, { status: 409 }), boundsMessage, false],
  ["an HTTP server error", () => new Response("Unavailable", { status: 503 }), "Could not confirm whether the probe moved.", true],
  ["an unreadable success response", () => new Response("{"), "Could not confirm whether the probe moved.", true],
  ["a failed connection", () => { throw new TypeError("Failed to fetch"); }, "Could not confirm whether the probe moved.", true],
])("preserves commands after %s and clears feedback when switching probes", async (_, moveResponse, message, pending) => {
  const fetchMock = vi.fn().mockImplementationOnce(moveResponse);
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  const onRefresh = vi.fn();
  const { rerender } = render(<MoveForm key="probe-1" probeId="probe-1" onMovingChange={vi.fn()} onRefresh={onRefresh} />);
  await user.type(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Commands" }), "RMM");
  await user.click(screen.getByRole("button", { name: "Send commands" }));

  expect((await screen.findByRole("alert")).textContent).toBe(message);
  const commands = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Commands" });
  expect(commands.value).toBe("RMM");
  expect(commands.disabled).toBe(pending);
  expect(screen.getByRole("button", { name: pending ? "Retry move" : "Send commands" }).matches(":disabled")).toBe(false);
  expect(onRefresh).toHaveBeenCalledTimes(pending ? 1 : 0);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  rerender(<MoveForm key="probe-2" probeId="probe-2" onMovingChange={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Commands" }).value).toBe("");
  expect(screen.queryByRole("alert")).toBeNull();
});

test("does not send a move when the tab cannot save its key", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MoveForm probeId="probe-1" onMovingChange={vi.fn()} onRefresh={vi.fn()} />);
  await user.type(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Commands" }), "M");
  await user.click(screen.getByRole("button", { name: "Send commands" }));

  expect(screen.getByRole("alert").textContent).toBe("Could not save this move in this tab. Try again.");
  expect(fetchMock).not.toHaveBeenCalled();
});
