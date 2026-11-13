import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { mockApiTransport } from '../testServer';

import { LaunchForm } from './LaunchForm';

afterEach(cleanup);

async function submitLaunch() {
  const user = userEvent.setup();
  const onLaunchComplete = vi.fn();
  render(<LaunchForm onLaunchComplete={onLaunchComplete} />);
  await user.click(screen.getByRole('button', { name: 'Launch probe' }));
  expect(
    screen.getByLabelText<HTMLSelectElement>('Initial direction').value
  ).toBe('NORTH');
  await user.type(
    screen.getByRole<HTMLInputElement>('spinbutton', { name: 'X limit' }),
    '5'
  );
  await user.type(screen.getByRole('spinbutton', { name: 'Y limit' }), '0');
  await user.selectOptions(screen.getByLabelText('Initial direction'), 'EAST');
  await user.click(screen.getByRole('button', { name: 'Launch' }));
  return onLaunchComplete;
}

test('reports the confirmed probe and closes the dialog', async () => {
  const probe = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    x: 0,
    y: 0,
    direction: 'EAST',
  };
  const requestMock = vi
    .fn()
    .mockResolvedValue(Response.json(probe, { status: 201 }));
  mockApiTransport(requestMock);

  const onLaunchComplete = await submitLaunch();

  expect(requestMock).toHaveBeenCalledWith('/probes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x: 5, y: 0, direction: 'EAST' }),
  });
  expect(onLaunchComplete).toHaveBeenCalledExactlyOnceWith(probe);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('shows grid validation in English and clears it when the value is corrected', async () => {
  const user = userEvent.setup();
  render(<LaunchForm />);
  await user.click(screen.getByRole('button', { name: 'Launch probe' }));
  const x = screen.getByRole<HTMLInputElement>('spinbutton', {
    name: 'X limit',
  });

  await user.click(screen.getByRole('button', { name: 'Launch' }));
  expect(x.validationMessage).toBe('Enter a whole number from 0 to 100.');

  await user.type(x, '5');
  expect(x.validity.valid).toBe(true);
});

test(
  'blocks dismissal while launching and closes the dialog on timeout',
  { timeout: 10_000 },
  async () => {
    let finishLaunch!: (response: Response) => void;
    mockApiTransport(
      () => new Promise<Response>(resolve => (finishLaunch = resolve))
    );
    const user = userEvent.setup();
    const onLaunchComplete = vi.fn();
    render(<LaunchForm onLaunchComplete={onLaunchComplete} />);
    await user.click(screen.getByRole('button', { name: 'Launch probe' }));
    const dialog = screen.getByRole('dialog');
    const fields = within(dialog);
    await user.type(
      fields.getByRole<HTMLInputElement>('spinbutton', { name: 'X limit' }),
      '0'
    );
    await user.type(fields.getByRole('spinbutton', { name: 'Y limit' }), '0');
    await user.click(fields.getByRole('button', { name: 'Launch' }));

    try {
      expect(
        fields.getByRole('button', { name: 'Cancel' }).matches(':disabled')
      ).toBe(true);
      expect(
        fields.getByRole('button', { name: 'Launching…' }).matches(':disabled')
      ).toBe(true);
      expect(
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
      ).toBe(false);
      await waitFor(
        () => expect(onLaunchComplete).toHaveBeenCalledExactlyOnceWith(null),
        { timeout: 7_500 }
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Launch probe' }));
      expect(
        screen.getByRole('button', { name: 'Launch' }).matches(':disabled')
      ).toBe(false);
    } finally {
      finishLaunch?.(new Response(null, { status: 201 }));
    }
  }
);
