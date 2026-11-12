import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './testServer';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

HTMLDialogElement.prototype.showModal ??= function () {
  this.open = true;
};

HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
};
