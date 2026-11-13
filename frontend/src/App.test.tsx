import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './App';
import type { Probe } from './modules/probes/types/probe';
import { mockApiTransport } from './testServer';

afterEach(cleanup);

const first: Probe = { id: 'probe-1', x: 0, y: 0, direction: 'NORTH' };
const second: Probe = { ...first, id: 'probe-2', direction: 'WEST' };
const firstDetail = { ...first, max_x: 3, max_y: 5 };
const secondDetail = { ...second, max_x: 7, max_y: 2 };
const firstMapPage = '/probes?limit=100&offset=0';
const uncertainLaunch =
  'Could not confirm whether the probe launched. Check the fleet before launching again.';

type MockRequest = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};
type MockHandler = (
  url: string,
  options: MockRequest
) => Response | Promise<Response> | undefined;

function mockApi(probes: Probe[], handle: MockHandler = () => undefined) {
  const requestMock = vi.fn(async (url: string, options: MockRequest) => {
    const response = handle(url, options);
    if (response !== undefined) return response;
    if (url === '/probes' || url.startsWith('/probes?')) {
      const query = new URLSearchParams(url.split('?')[1]);
      const offset = Number(query.get('offset') ?? 0);
      const limit = Number(query.get('limit') ?? 20);
      return Response.json({
        probes: probes.slice(offset, offset + limit),
      });
    }
    if (url === '/probes/probe-1') return Response.json(firstDetail);
    if (url === '/probes/probe-2') return Response.json(secondDetail);
    throw new Error('Unexpected request ' + url);
  });
  mockApiTransport(requestMock);
  return requestMock;
}

function selectProbe(user: ReturnType<typeof userEvent.setup>, id: string) {
  return user.click(screen.getByRole('button', { name: 'Select probe ' + id }));
}

async function submitLaunch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Launch probe' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Launch probe' }));
  const x = dialog.getByRole<HTMLInputElement>('spinbutton', {
    name: 'X limit',
  });
  await user.type(x, '5');
  await user.type(dialog.getByRole('spinbutton', { name: 'Y limit' }), '3');
  await user.click(dialog.getByRole('button', { name: 'Launch' }));
  return { dialog, x };
}

test.each([201, 400, 422, 503])(
  'handles a confirmed launch response (%s)',
  async status => {
    const probes: Probe[] = [];
    const message = status === 400 ? undefined : 'The API rejected the launch.';
    const requestMock = mockApi(probes, (url, options) => {
      if (url !== '/probes' || options.method !== 'POST') return;
      if (status !== 201) {
        const code = status === 503 ? 'DATABASE_BUSY' : 'INVALID_INPUT';
        return Response.json({ code, message }, { status });
      }
      probes.push(first);
      return Response.json(first, { status });
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('No probes launched.');
    await screen.findByText('No probes to display.');
    requestMock.mockClear();
    const { dialog, x } = await submitLaunch(user);

    if (status === 201) {
      const table = await screen.findByRole('table');
      expect(within(table).getByText(first.id)).toBeTruthy();
      expect(
        await screen.findByText(
          'Cell (0, 0): 1 probe, selected probe facing North'
        )
      ).toBeTruthy();
      expect(
        screen
          .getByRole('button', { name: 'Select probe probe-1' })
          .getAttribute('aria-pressed')
      ).toBe('true');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('Probe launched.')).toBeTruthy();
    } else {
      expect((await dialog.findByRole('alert')).textContent).toBe(
        message ?? 'Could not launch the probe.'
      );
      expect(x.value).toBe('5');
      expect(requestMock).toHaveBeenCalledTimes(1);
    }
  }
);

test.each(['lost response', 'generic 503'])(
  'refreshes the fleet and keeps the selection after a %s',
  async failure => {
    const probes: Probe[] = [];
    const requestMock = mockApi(probes, (url, options) => {
      if (url !== '/probes' || options.method !== 'POST') return;
      if (probes.length === 0) {
        probes.push(first);
        return Response.json(first, { status: 201 });
      }
      probes.push(second);
      if (failure === 'lost response') throw new TypeError('Failed to fetch');
      return Response.json(
        { message: 'Service unavailable.' },
        { status: 503 }
      );
    });
    const user = userEvent.setup();
    render(<App />);

    await submitLaunch(user);
    expect(await screen.findByText('Probe launched.')).toBeTruthy();
    await screen.findByText(
      'Cell (0, 0): 1 probe, selected probe facing North'
    );
    await screen.findByRole('table');
    requestMock.mockClear();
    await submitLaunch(user);

    await screen.findByText(uncertainLaunch);
    expect(screen.getByRole('alert').textContent).toBe(uncertainLaunch);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Probe launched.')).toBeNull();
    await screen.findByText(
      'Cell (0, 0): 2 probes, selected probe facing North'
    );
    expect(
      within(await screen.findByRole('table')).getByText(second.id)
    ).toBeTruthy();
    expect(screen.getByText('ID: probe-1')).toBeTruthy();
    expect(
      requestMock.mock.calls.filter(([, options]) => options.method === 'POST')
    ).toHaveLength(1);
    expect(requestMock).toHaveBeenCalledTimes(3);
  }
);

test('cycles through probes sharing a map cell by ID and keeps keyboard focus', async () => {
  mockApi([second, first]);
  const user = userEvent.setup();
  render(<App />);

  const map = within(await screen.findByRole('region', { name: 'Map grid' }));
  const marker = map.getByRole('button', {
    name: /Cell \(0, 0\): 2 probes.*Select probe probe-1/,
  });
  marker.focus();
  await user.keyboard('{Enter}');
  await screen.findByText('ID: probe-1');
  expect(
    screen
      .getByRole('button', { name: 'Select probe probe-1' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  expect(document.activeElement).toBe(marker);
  await user.keyboard(' ');
  expect(await screen.findByText('ID: probe-2')).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Select probe probe-2' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  await user.keyboard('{Enter}');
  expect(await screen.findByText('ID: probe-1')).toBeTruthy();
});

test('distinguishes matching UUID prefixes across fleet pages and uses full IDs for API calls and copying', async () => {
  const firstId = 'abcdef01-1000-4000-8000-000000000001';
  const secondId = 'abcdef01-3000-4000-8000-000000000002';
  const firstLabel = 'abcdef01-1';
  const secondLabel = 'abcdef01-3';
  const firstProbe = { ...first, id: firstId };
  const secondProbe = { ...second, id: secondId };
  const probes = [
    firstProbe,
    ...Array.from({ length: 19 }, (_, index) => ({
      ...first,
      id: `abcdef01-20${index.toString(16).padStart(2, '0')}-4000-8000-000000000003`,
      x: 2,
      y: 2,
    })),
    secondProbe,
  ];
  const requestMock = mockApi(probes, (url, { method }) => {
    if (url === `/probes/${firstId}`)
      return Response.json({ ...firstDetail, ...firstProbe });
    if (url === `/probes/${secondId}`)
      return Response.json({ ...secondDetail, ...secondProbe });
    if (url === `/probes/${secondId}/commands` && method === 'POST') {
      secondProbe.direction = 'NORTH';
      return Response.json(secondProbe);
    }
  });
  const user = userEvent.setup();
  render(<App />);

  const table = within(
    await screen.findByRole('table', { name: 'Probe fleet' })
  );
  const map = within(await screen.findByRole('region', { name: 'Map grid' }));
  expect(table.getByText(firstLabel)).toBeTruthy();
  expect(table.queryByText(secondLabel)).toBeNull();
  await user.click(
    table.getByRole('button', { name: `Select probe ${firstLabel}` })
  );
  expect(await screen.findByText(`ID: ${firstLabel}`)).toBeTruthy();
  expect(await screen.findByText(`Selected probe ${firstLabel}`)).toBeTruthy();
  await map.findByText('Cell (0, 0): 2 probes, selected probe facing North');
  expect(requestMock).toHaveBeenCalledWith(
    `/probes/${firstId}`,
    expect.anything()
  );

  await user.click(
    map.getByRole('button', {
      name: new RegExp(`Select probe ${secondLabel}$`),
    })
  );
  expect(await screen.findByText(`ID: ${secondLabel}`)).toBeTruthy();
  expect(await screen.findByText(`Selected probe ${secondLabel}`)).toBeTruthy();
  await map.findByText('Cell (0, 0): 2 probes, selected probe facing West');
  expect(requestMock).toHaveBeenCalledWith(
    `/probes/${secondId}`,
    expect.anything()
  );
  await user.click(screen.getByRole('button', { name: 'Next' }));
  const nextPage = within(
    await screen.findByRole('table', { name: 'Probe fleet' })
  );
  expect(nextPage.getByText(secondLabel)).toBeTruthy();
  expect(
    nextPage
      .getByRole('button', { name: `Select probe ${secondLabel}` })
      .getAttribute('aria-pressed')
  ).toBe('true');

  await user.click(screen.getByText('Full ID'));
  const copyButton = screen.getByRole('button', { name: 'Copy ID' });
  await user.click(copyButton);
  expect(await screen.findByText('ID copied.')).toBeTruthy();
  expect(await navigator.clipboard.readText()).toBe(secondId);
  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockRejectedValueOnce(new Error('Clipboard denied'));
  await user.click(copyButton);
  expect(
    await screen.findByText('Could not copy ID. Select and copy it manually.')
  ).toBeTruthy();
  expect(screen.getByText(secondId, { exact: true })).toBeTruthy();
  writeText.mockRestore();

  const form = within(screen.getByRole('form', { name: 'Move probe' }));
  await user.type(form.getByRole('textbox', { name: 'Commands' }), 'R');
  await user.click(form.getByRole('button', { name: 'Send commands' }));
  await form.findByText('Move confirmed.', { exact: false });
  expect(requestMock).toHaveBeenCalledWith(
    `/probes/${secondId}/commands`,
    expect.objectContaining({ method: 'POST', body: '{"commands":"R"}' })
  );
});

test('maps probes from every page and keeps selection when paging or sorting', async () => {
  const probes = [
    first,
    second,
    ...Array.from({ length: 98 }, (_, i) => ({
      ...first,
      id: 'additional-' + i,
      x: 2,
      y: 2,
    })),
    { ...first, id: 'last-probe', x: 8, y: 1 },
  ];
  const requestMock = mockApi(probes);
  const user = userEvent.setup();
  render(<App />);

  const table = await screen.findByRole('table');
  expect(within(table).queryByText('last-probe')).toBeNull();
  const overlap = await screen.findByText('Cell (0, 0): 2 probes');
  expect(
    overlap.closest('[role=listitem]')?.querySelector('.marker-glyph')
      ?.textContent
  ).toBe('2');
  expect(screen.getByText('Cell (8, 1): 1 probe')).toBeTruthy();
  expect(screen.getByText('Map bounds: (0, 0) to (8, 2)')).toBeTruthy();
  expect(requestMock).toHaveBeenCalledWith(
    '/probes?limit=100&offset=100',
    expect.anything()
  );

  await selectProbe(user, first.id);
  expect(
    await screen.findByText(
      'Cell (0, 0): 2 probes, selected probe facing North'
    )
  ).toBeTruthy();
  expect(screen.getByText('Map bounds: (0, 0) to (8, 5)')).toBeTruthy();
  expect(screen.getByText('(0, 0) to (3, 5)')).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Select probe probe-1' })
      .getAttribute('aria-pressed')
  ).toBe('true');

  requestMock.mockClear();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('additional-18')).toBeTruthy();
  await user.selectOptions(screen.getByLabelText('Sort by'), 'x');
  await screen.findByRole('button', { name: 'Select probe probe-1' });
  expect(
    screen.getByText('Cell (0, 0): 2 probes, selected probe facing North')
  ).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(screen.getByText('Map bounds: (0, 0) to (8, 2)')).toBeTruthy();
  expect(screen.queryByRole('form', { name: 'Move probe' })).toBeNull();
  expect(screen.getByText('Cell (0, 0): 2 probes')).toBeTruthy();
});

test('ignores detail responses superseded by another selection or by clearing it', async () => {
  const pending: {
    resolve: (response: Response) => void;
    signal: MockRequest['signal'];
  }[] = [];
  mockApi([first, second], (url, { signal }) => {
    if (url !== '/probes/probe-1') return;
    return new Promise<Response>(resolve => pending.push({ resolve, signal }));
  });
  const user = userEvent.setup();
  render(<App />);

  await screen.findByRole('table');
  await selectProbe(user, first.id);
  expect(screen.getByText('Loading selected probe…')).toBeTruthy();
  await selectProbe(user, second.id);
  expect(
    await screen.findByText('Cell (0, 0): 2 probes, selected probe facing West')
  ).toBeTruthy();
  expect(pending[0].signal?.aborted).toBe(true);
  await act(async () => pending[0].resolve(Response.json(firstDetail)));
  expect(screen.getByText('(0, 0) to (7, 2)')).toBeTruthy();

  await selectProbe(user, first.id);
  expect(screen.getByText('Cell (0, 0): 2 probes')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(pending[1].signal?.aborted).toBe(true);
  await act(async () => pending[1].resolve(Response.json(firstDetail)));
  expect(screen.queryByText('Selected probe', { selector: 'h3' })).toBeNull();
  expect(screen.getByText('Cell (0, 0): 2 probes')).toBeTruthy();
});

test('retries map and detail independently and keeps the overview after detail failure', async () => {
  let mapReads = 0;
  let detailReads = 0;
  const requestMock = mockApi([first, second], url => {
    if (url === firstMapPage && ++mapReads === 1) {
      return Response.json({ message: 'Map unavailable.' }, { status: 503 });
    }
    if (url === '/probes/probe-1' && ++detailReads === 1) {
      return Response.json({ message: 'Probe not found.' }, { status: 404 });
    }
  });
  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByText('Map unavailable.')).toBeTruthy();
  requestMock.mockClear();
  await user.click(screen.getByRole('button', { name: 'Retry map' }));
  expect(await screen.findByText('Cell (0, 0): 2 probes')).toBeTruthy();
  expect(requestMock.mock.calls.map(([url]) => url)).toEqual([firstMapPage]);

  await selectProbe(user, second.id);
  expect(
    await screen.findByText('Cell (0, 0): 2 probes, selected probe facing West')
  ).toBeTruthy();
  await selectProbe(user, first.id);
  expect(await screen.findByText('Probe not found.')).toBeTruthy();
  expect(screen.getByText('Cell (0, 0): 2 probes')).toBeTruthy();

  requestMock.mockClear();
  await user.click(screen.getByRole('button', { name: 'Retry detail' }));
  expect(
    await screen.findByText(
      'Cell (0, 0): 2 probes, selected probe facing North'
    )
  ).toBeTruthy();
  expect(requestMock.mock.calls.map(([url]) => url)).toEqual([
    '/probes/probe-1',
  ]);
});

test('refreshes the same page and highlights the confirmed position without double counting', async () => {
  const probes = [
    first,
    second,
    ...Array.from({ length: 19 }, (_, i) => ({
      ...first,
      id: 'additional-' + i,
      x: 2,
      y: 2,
    })),
  ];
  const moved = { ...first, x: 1, y: 1, direction: 'EAST' };
  let resolveMove!: (response: Response) => void;
  let confirmed = false;
  const requestMock = mockApi(probes, url => {
    if (url === '/probes/probe-1/commands') {
      return new Promise<Response>(resolve => {
        resolveMove = resolve;
      });
    }
    if (confirmed && url === '/probes/probe-1')
      return Response.json({ ...firstDetail, ...moved });
    if (confirmed && url.startsWith('/probes?limit=21&'))
      return Response.json({ probes: probes.slice(-1) });
  });
  const user = userEvent.setup();
  render(<App />);

  await screen.findByRole('table');
  await user.selectOptions(screen.getByLabelText('Sort by'), 'x');
  await screen.findByRole('table');
  await selectProbe(user, first.id);
  expect(
    await screen.findByText(
      'Cell (0, 0): 2 probes, selected probe facing North'
    )
  ).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('button', { name: 'Select probe additional-18' });

  requestMock.mockClear();
  const form = screen.getByRole('form', { name: 'Move probe' });
  const commands = within(form).getByRole<HTMLTextAreaElement>('textbox', {
    name: 'Commands',
  });
  await user.click(within(form).getByRole('button', { name: 'M Move' }));
  await user.click(within(form).getByRole('button', { name: 'R Right' }));
  await user.click(within(form).getByRole('button', { name: 'M Move' }));
  expect(commands.value).toBe('MRM');
  await user.click(within(form).getByRole('button', { name: 'Send commands' }));
  const pending = within(form).getByRole('button', { name: 'Sending…' });
  const switchProbe = screen.getByRole('button', {
    name: 'Select probe additional-18',
  });
  const clear = screen.getByRole('button', { name: 'Clear selection' });
  const map = within(screen.getByRole('region', { name: 'Map grid' }));
  expect(
    [
      pending,
      switchProbe,
      clear,
      screen.getByRole('button', { name: 'Launch probe' }),
      ...map.getAllByRole('button'),
    ].every(button => button.matches(':disabled'))
  ).toBe(true);
  await user.click(pending);
  await user.click(switchProbe);
  expect(requestMock).toHaveBeenCalledExactlyOnceWith(
    '/probes/probe-1/commands',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands: 'MRM' }),
    }
  );

  confirmed = true;
  await act(async () => resolveMove(Response.json(moved)));
  expect(within(form).getByRole('status').textContent).toContain(
    'Position: (1, 1) · Direction: East'
  );
  expect(screen.getByText('ID: probe-1')).toBeTruthy();
  expect(commands.value).toBe('');
  expect(screen.getByText('Page 2')).toBeTruthy();
  expect(
    await screen.findByText('Cell (1, 1): 1 probe, selected probe facing East')
  ).toBeTruthy();
  expect(screen.getByText('Cell (0, 0): 1 probe')).toBeTruthy();
});

test('refreshes the position and clears the submitted commands after a lost move response', async () => {
  const probes = [first];
  const requestMock = mockApi(probes, (url, options) => {
    if (url === '/probes/probe-1') {
      return Response.json({ ...firstDetail, ...probes[0] });
    }
    if (url !== '/probes/probe-1/commands' || options?.method !== 'POST')
      return;

    probes[0] = { ...probes[0], y: probes[0].y + 1 };
    throw new TypeError('Failed to fetch');
  });
  const user = userEvent.setup();
  render(<App />);

  await screen.findByRole('table');
  await selectProbe(user, first.id);
  await screen.findByText('Cell (0, 0): 1 probe, selected probe facing North');
  const form = screen.getByRole('form', { name: 'Move probe' });
  const commands = within(form).getByRole<HTMLTextAreaElement>('textbox', {
    name: 'Commands',
  });
  await user.type(commands, 'M');
  await user.click(within(form).getByRole('button', { name: 'Send commands' }));

  expect((await within(form).findByRole('alert')).textContent).toBe(
    'Could not confirm whether the probe moved.'
  );
  await screen.findByText('Cell (0, 1): 1 probe, selected probe facing North');
  expect(commands.value).toBe('');
  expect(commands.disabled).toBe(false);
  expect(within(form).queryByRole('button', { name: 'Retry move' })).toBeNull();
  expect(
    requestMock.mock.calls.filter(([, options]) => options.method === 'POST')
  ).toHaveLength(1);
});
