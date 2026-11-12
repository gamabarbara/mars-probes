import { useState } from "react";
import type { FormEvent } from "react";

import { directionLabels } from "../directionLabels";

import type { ApiError, Probe } from "../probeTypes";

type MoveFormProps = {
  probeId: string;
  moving?: boolean;
  onMovingChange: (moving: boolean) => void;
  onRefresh: () => void;
};

const uncertainMove = "Could not confirm whether the probe moved.";

export function MoveForm({ probeId, moving, onMovingChange, onRefresh }: MoveFormProps) {
  const [commands, setCommands] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Probe | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (moving) return;

    setError(null);
    setPosition(null);
    if (commands.length < 1 || commands.length > 1000 || /[^LRM]/.test(commands)) {
      setError("Enter 1 to 1000 commands using only uppercase L, R, and M.");
      return;
    }

    onMovingChange(true);
    try {
      const response = await fetch(`/probes/${encodeURIComponent(probeId)}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands }),
      });
      if (!response.ok) {
        const body: ApiError | null = await response.json().catch(() => null);
        if (response.status >= 400 && response.status < 500) {
          setError(body?.message || "Could not move the probe.");
          return;
        }
        setError(body?.message || uncertainMove);
      } else {
        const result: Probe | null = await response.json();
        if (result?.id !== probeId || !Number.isInteger(result.x) ||
            !Number.isInteger(result.y) || !Object.hasOwn(directionLabels, result.direction)) {
          throw new Error("Invalid move response");
        }
        setPosition(result);
      }
    } catch {
      setError(uncertainMove);
    } finally {
      onMovingChange(false);
    }
    setCommands("");
    onRefresh();
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
        disabled={moving}
        placeholder="e.g. MRM"
      />
      <p id="commands-help" className="muted text-sm">
        Use 1 to 1000 uppercase commands without spaces.
      </p>
      <div role="group" aria-label="Add a command" className="command-keys">
        {[["L", "Left"], ["M", "Move"], ["R", "Right"]].map(([command, label]) => (
          <button key={command} type="button" className="mission-button"
            disabled={moving || commands.length >= 1000}
            onClick={() => setCommands((value) => value + command)}>
            <kbd>{command}</kbd> {label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={moving}
        className="mission-button primary"
      >
        {moving ? "Sending…" : "Send commands"}
      </button>
      {error && <p lang="en" role="alert" className="mission-error">{error}</p>}
      {position && (
        <p role="status" className="mission-success">
          Move confirmed. Position: ({position.x}, {position.y}) · Direction: {directionLabels[position.direction]}
        </p>
      )}
    </form>
  );
}
