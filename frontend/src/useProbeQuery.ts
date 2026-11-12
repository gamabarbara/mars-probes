import { useEffect, useState } from "react";

import type { ApiError } from "./probeTypes";

type QueryOutcome<T> =
  | { status: "success"; data: T }
  | { status: "error"; message: string };

type QueryResult<T> = QueryOutcome<T> & { url: string; revision: number; attempt: number };

export type ProbeQuery<T> = (QueryOutcome<T> | { status: "loading" }) & { retry: () => void };

export function useProbeQuery<T>(url: string | null, revision: number, fallbackMessage: string): ProbeQuery<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<QueryResult<T> | null>(null);

  useEffect(() => {
    setResult(null);
    if (url === null) return;

    const controller = new AbortController();
    const { signal } = controller;

    const finish = (outcome: QueryOutcome<T>) => {
      if (!signal.aborted) setResult({ url, revision, attempt, ...outcome });
    };

    const load = async () => {
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) {
          const body: ApiError | null = await response.json().catch(() => null);
          finish({ status: "error", message: body?.message || fallbackMessage });
          return;
        }
        const data: T = await response.json();
        finish({ status: "success", data });
      } catch {
        finish({ status: "error", message: fallbackMessage });
      }
    };

    void load();
    return () => controller.abort();
  }, [url, revision, attempt, fallbackMessage]);

  const current = result?.url === url && result.revision === revision && result.attempt === attempt;
  return {
    ...(current ? result : { status: "loading" }),
    retry: () => setAttempt((count) => count + 1),
  };
}
