import { useEffect, useState } from "react";

import { ProbeApiError, readProbeData } from "../services/probeService";

type QueryOutcome<T> =
  | { status: "success"; data: T }
  | { status: "error"; message: string };

type QueryResult<T> = QueryOutcome<T> & { url: string; revision: number; attempt: number };

export type ProbeQuery<T> = (QueryOutcome<T> | { status: "loading" }) & { retry: () => void };

type ReadQuery<T> = (url: string) => Promise<T>;
type LoadQuery<T> = (url: string, read: ReadQuery<T>) => Promise<T>;

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

    const read: ReadQuery<T> = (pageUrl) => readProbeData<T>(pageUrl, signal);

    const load = async () => {
      try {
        const data = await (loadQuery ? loadQuery(url, read) : read(url));
        finish({ status: "success", data });
      } catch (error) {
        const message = error instanceof ProbeApiError ? error.message : "";
        finish({ status: "error", message: message || fallbackMessage });
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
