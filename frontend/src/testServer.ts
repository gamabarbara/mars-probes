import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const server = setupServer();

type MockRequest = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

export function mockApiTransport(
  handler: (url: string, options: MockRequest) => Response | Promise<Response>
) {
  server.use(
    http.all(/\/probes(?:\/.*)?$/, async ({ request }) => {
      const url = new URL(request.url);
      const options: MockRequest =
        request.method === 'GET'
          ? { signal: request.signal }
          : {
              method: request.method,
              headers: Object.fromEntries(
                ['Content-Type', 'Idempotency-Key']
                  .filter(name => request.headers.has(name))
                  .map(name => [name, request.headers.get(name)!])
              ),
              body: await request.text(),
            };
      try {
        return await handler(url.pathname + url.search, options);
      } catch {
        return HttpResponse.error();
      }
    })
  );
}
