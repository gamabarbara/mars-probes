import { useState } from "react";
import type { FormEvent } from "react";

import { directionLabels } from "../directionLabels";
import { moveProbe, ProbeApiError } from "../services/probeService";
import type { Probe } from "../types/probe";

export type MoveFormProps = {
  probeId: string;
  moving?: boolean;
  onMovingChange: (moving: boolean) => void;
  onRefresh: () => void;
};

const uncertainMove = "Could not confirm whether the probe moved.";

export function useMoveForm({ probeId, moving, onMovingChange, onRefresh }: MoveFormProps) {
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
      const result = await moveProbe(probeId, commands);
      if (result?.id !== probeId || !Number.isInteger(result.x) ||
          !Number.isInteger(result.y) || !Object.hasOwn(directionLabels, result.direction)) {
        throw new Error("Invalid move response");
      }
      setPosition(result);
    } catch (error) {
      if (error instanceof ProbeApiError && error.status >= 400 && error.status < 500) {
        setError(error.message || "Could not move the probe.");
        return;
      }
      setError(error instanceof ProbeApiError && error.message ? error.message : uncertainMove);
    } finally {
      onMovingChange(false);
    }
    setCommands("");
    onRefresh();
  }

  return { commands, setCommands, error, position, handleSubmit };
}
