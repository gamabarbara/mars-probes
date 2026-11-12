import { useEffect, useState } from "react";

import type { ApiError } from "./probeTypes";

type QueryOutcome<T> =
  | { status: "success"; data: T }
  | { status: "error"; message: string };

type QueryResult<T> = QueryOutcome<T> & { url: string; revision: number; attempt: number };

export type ProbeQuery<T> = (QueryOutcome<T> | { status: "loading" }) & { retry: () => void };

type ReadQuery<T> = (url: string) => Promise<T>;
type LoadQuery<T> = (url: string, read: ReadQuery<T>) => Promise<T>;

class ProbeQueryError extends Error {}

export function useProbeQuery<T>(
  url: string | null, revision: number, fallbackMessage: string, loadQuery?: LoadQuery<T>,
): ProbeQuery<T> {
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

    const read: ReadQuery<T> = async (pageUrl) => {
      signal.throwIfAborted();
      const response = await fetch(pageUrl, { signal });
      if (!response.ok) {
        const body: ApiError | null = await response.json().catch(() => null);
        throw new ProbeQueryError(body?.message || fallbackMessage);
      }
      return response.json();
    };

    const load = async () => {
      try {
        const data = await (loadQuery ? loadQuery(url, read) : read(url));
        finish({ status: "success", data });
      } catch (error) {
        finish({ status: "error", message: error instanceof ProbeQueryError ? error.message : fallbackMessage });
      }
    };

    void load();
    return () => controller.abort();
  }, [url, revision, attempt, fallbackMessage, loadQuery]);

  const current = result?.url === url && result.revision === revision && result.attempt === attempt;
  return {
    ...(current ? result : { status: "loading" }),
    retry: () => setAttempt((count) => count + 1),
  };
}
