import { useState } from "react";
import type { FormEvent } from "react";

import { launchProbe, ProbeApiError } from "../services/probeService";
import type { Probe } from "../types/probe";

export function useLaunchProbe(onLaunched: (probe: Probe) => void) {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (launching) return;
    const form = new FormData(event.currentTarget);
    setLaunching(true);
    setError(null);

    try {
      const probe = await launchProbe({
        x: Number(form.get("x")),
        y: Number(form.get("y")),
        direction: form.get("direction"),
      });
      onLaunched(probe);
    } catch (error) {
      setError(error instanceof ProbeApiError
        ? error.message || "Could not launch the probe. Try again."
        : "Could not connect to the API. Try again.");
    } finally {
      setLaunching(false);
    }
  }

  return { launching, error, clearError: () => setError(null), handleSubmit };
}
