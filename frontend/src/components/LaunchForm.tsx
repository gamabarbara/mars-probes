import { useRef } from 'react';
import type { FormEvent } from 'react';

import { directionLabels } from '../contants/directionLabels';
import { useLaunchProbe } from '../modules/probes/hooks/useLaunchProbe';
import type { Probe } from '../modules/probes/types/probe';

const gridValidation = {
  onInvalid(event: FormEvent<HTMLInputElement>) {
    event.currentTarget.setCustomValidity(
      'Enter a whole number from 0 to 100.'
    );
  },
  onInput(event: FormEvent<HTMLInputElement>) {
    event.currentTarget.setCustomValidity('');
  },
};

type LaunchFormProps = {
  disabled?: boolean;
  onLaunched?: (probe: Probe) => void;
};

export function LaunchForm({ disabled, onLaunched }: LaunchFormProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const formElement = useRef<HTMLFormElement>(null);
  const xLimit = useRef<HTMLInputElement>(null);
  const { launching, error, setError, handleSubmit } = useLaunchProbe(
    dialog,
    onLaunched
  );

  function openDialog() {
    setError(null);
    const form = formElement.current;
    if (!form || !dialog.current) return;
    form.reset();
    for (const field of form.querySelectorAll('input'))
      field.setCustomValidity('');
    dialog.current.showModal();
    xLimit.current?.focus();
  }

  return (
    <>
      <button
        type="button"
        className="mission-button primary"
        disabled={disabled}
        onClick={openDialog}
      >
        <span aria-hidden="true">＋</span> Launch probe
      </button>
      <dialog
        ref={dialog}
        className="launch-dialog"
        aria-labelledby="launch-title"
        onCancel={event => {
          if (launching) event.preventDefault();
        }}
      >
        <form
          ref={formElement}
          className="launch-fields"
          onSubmit={handleSubmit}
        >
          <h2 id="launch-title">Launch probe</h2>
          <p id="grid-help">
            Set the grid limits from 0 to 100. The probe starts at (0, 0).
          </p>
          <fieldset disabled={launching} className="launch-grid">
            <label>
              X limit
              <input
                className="mission-field"
                ref={xLimit}
                name="x"
                type="number"
                min="0"
                max="100"
                step="1"
                required
                aria-describedby="grid-help"
                {...gridValidation}
              />
            </label>
            <label>
              Y limit
              <input
                className="mission-field"
                name="y"
                type="number"
                min="0"
                max="100"
                step="1"
                required
                aria-describedby="grid-help"
                {...gridValidation}
              />
            </label>
            <label className="launch-direction">
              Initial direction
              <select
                className="mission-field"
                name="direction"
                defaultValue="NORTH"
              >
                {Object.entries(directionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="mission-error">
              {error}
            </p>
          )}
          <div className="launch-actions">
            <button
              type="button"
              className="mission-button"
              disabled={launching}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mission-button primary"
              disabled={launching}
            >
              {launching ? 'Launching…' : 'Launch'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
