import { useState } from "react";
import type { FormEvent } from "react";

import { directionLabels } from "../directionLabels";

import type { ApiError, Probe } from "../probeTypes";

type PendingMove = { key: string; commands: string };
type MoveFormProps = {
  probeId: string;
  moving?: boolean;
  onMovingChange: (moving: boolean) => void;
  detailLoading?: boolean;
  onRefresh: () => void;
};

const uncertainMove = "Could not confirm whether the probe moved.";

function readPendingMove(storageKey: string): PendingMove | null {
  try {
    const value = sessionStorage.getItem(storageKey);
    return value === null ? null : JSON.parse(value);
  } catch {
    return null;
  }
}

export function MoveForm({ probeId, moving, onMovingChange, detailLoading, onRefresh }: MoveFormProps) {
  const storageKey = `mars-probes:pending-move:${probeId}`;
  const [pending, setPending] = useState(() => readPendingMove(storageKey));
  const [commands, setCommands] = useState(pending?.commands ?? "");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Probe | null>(null);
  const editDisabled = moving || pending !== null;
  const submitDisabled = moving || (pending !== null && detailLoading);

  function clearPending() {
    sessionStorage.removeItem(storageKey);
    setPending(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
        const body: ApiError | null = await response.json().catch(() => null);
        if (response.status >= 400 && response.status < 500) {
          clearPending();
          setError(body?.message || "Could not move the probe.");
        } else {
          setError(body?.message || uncertainMove);
          onRefresh();
        }
        return;
      }

      const result: Probe | null = await response.json();
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
    <form className="move-form" aria-label="Move probe" onSubmit={handleSubmit}>
      <label htmlFor="probe-commands">Commands</label>
      <textarea
        id="probe-commands"
        className="mission-field"
        rows={2}
        value={commands}
        onChange={(event) => setCommands(event.target.value)}
        aria-describedby="commands-help"
        autoCapitalize="off"
        spellCheck={false}
        disabled={editDisabled}
        placeholder="e.g. MRM"
      />
      <p id="commands-help" className="muted text-sm">
        Use 1 to 1000 uppercase commands without spaces.
      </p>
      <div role="group" aria-label="Add a command" className="command-keys">
        {[["L", "Left"], ["M", "Move"], ["R", "Right"]].map(([command, label]) => (
          <button key={command} type="button" className="mission-button"
            disabled={editDisabled || commands.length >= 1000}
            onClick={() => setCommands((value) => value + command)}>
            <kbd>{command}</kbd> {label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={submitDisabled}
        className="mission-button primary"
      >
        {moving ? "Sending…" : pending ? "Retry move" : "Send commands"}
      </button>
      {error && <p lang="en" role="alert" className="mission-error">{error}</p>}
      {pending && !moving && !error && <p role="status">{uncertainMove}</p>}
      {position && (
        <p role="status" className="mission-success">
          Move confirmed. Position: ({position.x}, {position.y}) · Direction: {directionLabels[position.direction]}
        </p>
      )}
    </form>
  );
}
