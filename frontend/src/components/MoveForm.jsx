import { useState } from "react";

import { directionLabels } from "../directionLabels.js";

const uncertainMove = "Could not confirm whether the probe moved.";

function readPendingMove(storageKey) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

export function MoveForm({ probeId, moving, onMovingChange, detailLoading, onRefresh }) {
  const storageKey = `mars-probes:pending-move:${probeId}`;
  const [pending, setPending] = useState(() => readPendingMove(storageKey));
  const [commands, setCommands] = useState(pending?.commands ?? "");
  const [error, setError] = useState(null);
  const [position, setPosition] = useState(null);
  const submitDisabled = moving || (pending !== null && detailLoading);

  function clearPending() {
    sessionStorage.removeItem(storageKey);
    setPending(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitDisabled) return;

    setError(null);
    setPosition(null);
    if (commands.length < 1 || commands.length > 1000 || /[^LRM]/.test(commands)) {
      setError("Enter 1 to 1000 commands using only uppercase L, R, and M.");
      return;
    }

    let attempt = pending;
    if (!attempt) {
      try {
        attempt = { key: crypto.randomUUID(), commands };
        sessionStorage.setItem(storageKey, JSON.stringify(attempt));
        setPending(attempt);
      } catch {
        setError("Could not save this move in this tab. Try again.");
        return;
      }
    }

    onMovingChange(true);
    try {
      const response = await fetch(`/probes/${encodeURIComponent(probeId)}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key },
        body: JSON.stringify({ commands: attempt.commands }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status >= 400 && response.status < 500) {
          clearPending();
          setError(body?.message || "Could not move the probe.");
        } else {
          setError(body?.message || uncertainMove);
          onRefresh();
        }
        return;
      }

      const result = await response.json();
      if (result?.id !== probeId || !Number.isInteger(result.x) ||
          !Number.isInteger(result.y) || !Object.hasOwn(directionLabels, result.direction)) {
        throw new Error("Invalid move response");
      }
      clearPending();
      setPosition(result);
      setCommands("");
      onRefresh();
    } catch {
      setError(uncertainMove);
      onRefresh();
    } finally {
      onMovingChange(false);
    }
  }

  return (
    <form className="space-y-3 rounded-xl border border-slate-200 p-5" aria-labelledby="move-title" onSubmit={handleSubmit}>
      <h3 id="move-title" className="font-semibold">Move probe</h3>
      <p className="wrap-anywhere text-sm">ID: {probeId}</p>
      <label htmlFor="probe-commands" className="block text-sm font-medium">Commands</label>
      <textarea
        id="probe-commands"
        className="w-full rounded-md border border-slate-400 bg-white px-3 py-2"
        rows={2}
        value={commands}
        onChange={(event) => setCommands(event.target.value)}
        aria-describedby="commands-help"
        autoCapitalize="off"
        spellCheck={false}
        disabled={moving || pending !== null}
      />
      <p id="commands-help" className="text-sm text-slate-600">
        Enter 1 to 1000 uppercase commands without spaces. L turns left, R turns right, and M moves forward.
      </p>
      <button
        type="submit"
        disabled={submitDisabled}
        className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {moving ? "Sending…" : pending ? "Retry move" : "Send commands"}
      </button>
      {error && <p lang="en" role="alert" className="text-red-800">{error}</p>}
      {pending && !moving && !error && <p role="status">{uncertainMove}</p>}
      {position && (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-emerald-950">
          Move confirmed. Position: ({position.x}, {position.y}) · Direction: {directionLabels[position.direction]}
        </p>
      )}
    </form>
  );
}
