import { useState } from 'react';
import type { FormEvent, RefObject } from 'react';

import { getApiError } from '../../../shared/services/apiError';
import { probeService } from '../services/probeService';
import type { Probe } from '../types/probe';

export function useLaunchProbe(
  dialog: RefObject<HTMLDialogElement | null>,
  onLaunched?: (probe: Probe) => void
) {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (launching) return;
    const form = new FormData(event.currentTarget);
    setLaunching(true);
    setError(null);

    try {
      const probe = await probeService.launch({
        x: Number(form.get('x')),
        y: Number(form.get('y')),
        direction: form.get('direction'),
      });
      dialog.current?.close();
      onLaunched?.(probe);
    } catch (error) {
      const apiError = getApiError(error);
      setError(
        apiError.status === undefined
          ? 'Could not connect to the API. Try again.'
          : apiError.message || 'Could not launch the probe. Try again.'
      );
    } finally {
      setLaunching(false);
    }
  }

  return { launching, error, setError, handleSubmit };
}
