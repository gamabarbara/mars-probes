import { useState } from 'react';
import type { FormEvent, RefObject } from 'react';

import { getApiError } from '../../../shared/services/apiError';
import { probeService } from '../services/probeService';
import type { Probe } from '../types/probe';

export function useLaunchProbe(
  dialog: RefObject<HTMLDialogElement | null>,
  onLaunchComplete?: (probe: Probe | null) => void
) {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (launching) return;
    const form = new FormData(event.currentTarget);
    setLaunching(true);
    setError(null);

    let probe: Probe | null = null;
    try {
      probe = await probeService.launch({
        x: Number(form.get('x')),
        y: Number(form.get('y')),
        direction: form.get('direction'),
      });
    } catch (error) {
      const { status, code, message } = getApiError(error);
      if (
        status === 400 ||
        status === 422 ||
        (status === 503 && code === 'DATABASE_BUSY')
      ) {
        setError(message || 'Could not launch the probe.');
        return;
      }
    } finally {
      setLaunching(false);
    }

    dialog.current?.close();
    onLaunchComplete?.(probe);
  }

  return { launching, error, setError, handleSubmit };
}
