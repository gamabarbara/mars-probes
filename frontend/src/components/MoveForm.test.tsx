import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { mockApiTransport } from '../testServer';

import { MoveForm } from './MoveForm';

afterEach(cleanup);

test.each(['', 'm', 'M M', 'M\n', 'M'.repeat(1001)])(
  'rejects invalid commands without posting them',
  async value => {
    const requestMock = vi.fn();
    mockApiTransport(requestMock);
    const user = userEvent.setup();
    render(
      <MoveForm
        probeId="probe-1"
        onMovingChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    fireEvent.change(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Commands' }),
      { target: { value } }
    );
    await user.click(screen.getByRole('button', { name: 'Send commands' }));

    expect(screen.getByRole('alert').textContent).toBe(
      'Enter 1 to 1000 commands using only uppercase L, R, and M.'
    );
    expect(requestMock).not.toHaveBeenCalled();
  }
);

const boundsMessage =
  'The command at step 3 would move the probe outside the grid.';

test.each([
  [
    'a rejected sequence',
    () => Response.json({ message: boundsMessage, step: 3 }, { status: 409 }),
    boundsMessage,
    false,
  ],
  [
    'an HTTP server error',
    () => new Response('Unavailable', { status: 503 }),
    'Could not confirm whether the probe moved.',
    true,
  ],
  [
    'an unreadable success response',
    () => new Response('{'),
    'Could not confirm whether the probe moved.',
    true,
  ],
  [
    'a failed connection',
    () => {
      throw new TypeError('Failed to fetch');
    },
    'Could not confirm whether the probe moved.',
    true,
  ],
])('handles %s', async (_, moveResponse, message, outcomeUncertain) => {
  const requestMock = vi.fn().mockImplementationOnce(moveResponse);
  mockApiTransport(requestMock);
  const user = userEvent.setup();
  const onRefresh = vi.fn();
  render(
    <MoveForm
      key="probe-1"
      probeId="probe-1"
      onMovingChange={vi.fn()}
      onRefresh={onRefresh}
    />
  );
  await user.type(
    screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Commands' }),
    'RMM'
  );
  await user.click(screen.getByRole('button', { name: 'Send commands' }));

  expect((await screen.findByRole('alert')).textContent).toBe(message);
  const commands = screen.getByRole<HTMLTextAreaElement>('textbox', {
    name: 'Commands',
  });
  expect(commands.value).toBe(outcomeUncertain ? '' : 'RMM');
  expect(commands.disabled).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Send commands' }).matches(':disabled')
  ).toBe(false);
  expect(onRefresh).toHaveBeenCalledTimes(outcomeUncertain ? 1 : 0);
  expect(requestMock).toHaveBeenCalledTimes(1);
});

test('clears feedback when switching probes', async () => {
  mockApiTransport(
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: boundsMessage }, { status: 409 })
      )
  );
  const user = userEvent.setup();
  const { rerender } = render(
    <MoveForm
      key="probe-1"
      probeId="probe-1"
      onMovingChange={vi.fn()}
      onRefresh={vi.fn()}
    />
  );
  await user.type(
    screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Commands' }),
    'M'
  );
  await user.click(screen.getByRole('button', { name: 'Send commands' }));
  expect((await screen.findByRole('alert')).textContent).toBe(boundsMessage);

  rerender(
    <MoveForm
      key="probe-2"
      probeId="probe-2"
      onMovingChange={vi.fn()}
      onRefresh={vi.fn()}
    />
  );
  expect(
    screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Commands' }).value
  ).toBe('');
  expect(screen.queryByRole('alert')).toBeNull();
});
