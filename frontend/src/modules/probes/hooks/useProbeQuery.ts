import { useEffect, useState } from 'react';

import { getApiError } from '../../../shared/services/apiError';
import { probeService } from '../services/probeService';

type QueryOutcome<T> =
  { status: 'success'; data: T } | { status: 'error'; message: string };

type QueryResult<T> = QueryOutcome<T> & {
  url: string;
  revision: number;
  attempt: number;
};

export type ProbeQuery<T> = (QueryOutcome<T> | { status: 'loading' }) & {
  retry: () => void;
};

export function useProbeQuery<T>(
  url: string | null,
  revision: number,
  fallbackMessage: string,
  loadQuery: (url: string, signal: AbortSignal) => Promise<T> = probeService.get
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

    const load = async () => {
      try {
        const data = await loadQuery(url, signal);
        finish({ status: 'success', data });
      } catch (error) {
        finish({
          status: 'error',
          message: getApiError(error).message || fallbackMessage,
        });
      }
    };

    void load();
    return () => controller.abort();
  }, [url, revision, attempt, fallbackMessage, loadQuery]);

  const current =
    result?.url === url &&
    result.revision === revision &&
    result.attempt === attempt;
  return {
    ...(current ? result : { status: 'loading' }),
    retry: () => setAttempt(count => count + 1),
  };
}
