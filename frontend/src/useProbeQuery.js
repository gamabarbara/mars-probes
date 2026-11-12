import { useEffect, useState } from "react";

export function useProbeQuery(url, revision, fallbackMessage) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setResult(null);
    if (url === null) return;

    const controller = new AbortController();
    const { signal } = controller;

    function finish(outcome) {
      if (!signal.aborted) setResult({ url, revision, attempt, ...outcome });
    }

    async function load() {
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          finish({ status: "error", message: body?.message || fallbackMessage });
          return;
        }
        finish({ status: "success", data: await response.json() });
      } catch {
        finish({ status: "error", message: fallbackMessage });
      }
    }

    load();
    return () => controller.abort();
  }, [url, revision, attempt, fallbackMessage]);

  const current = result?.url === url && result.revision === revision && result.attempt === attempt;
  return {
    ...(current ? result : { status: "loading" }),
    retry: () => setAttempt((count) => count + 1),
  };
}
