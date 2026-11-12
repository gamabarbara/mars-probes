import type { Probe } from "../types/probe";

export class ProbeApiError extends Error {
  constructor(readonly status: number, message?: string) {
    super(message);
  }
}

export async function readProbeData<T>(url: string, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return requestProbeData<T>(url, { signal });
}

export function launchProbe(input: { x: number; y: number; direction: FormDataEntryValue | null }) {
  return postProbeData("/probes", input);
}

export function moveProbe(id: string, commands: string) {
  return postProbeData(`/probes/${encodeURIComponent(id)}/commands`, { commands });
}

function postProbeData(url: string, body: object) {
  return requestProbeData<Probe>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function requestProbeData<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body: { message?: string } | null = await response.json().catch(() => null);
    throw new ProbeApiError(response.status, body?.message);
  }
  return response.json();
}
