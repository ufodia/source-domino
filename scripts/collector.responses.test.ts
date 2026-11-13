import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';

const network = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: network.lookup }));
vi.mock('node:http', () => ({ default: { request: network.request } }));
vi.mock('node:https', () => ({ default: { request: network.request } }));
import { collectSource } from './collector';

interface ResponseSpec { status: number; headers?: IncomingHttpHeaders; body?: string }
interface FakeResponse extends EventEmitter { destroyed: boolean; destroy: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> }
const responses: FakeResponse[] = [];
const events: string[] = [];

function installResponses(specs: ResponseSpec[]) {
  let index = 0;
  network.request.mockImplementation((url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    const spec = specs[index++];
    if (!spec) throw new Error('Unexpected extra request in collector test.');
    events.push(`request:${url.pathname}`);
    const lookupCallback = vi.fn();
    (options.lookup as (host: string, opts: object, callback: (...args: unknown[]) => void) => void)(url.hostname, {}, lookupCallback);
    expect(lookupCallback).toHaveBeenCalledWith(null, '1.1.1.1', 4);
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options.headers).not.toHaveProperty('Cookie');
    const request = new EventEmitter() as EventEmitter & { end(): void; destroy(error?: Error): void };
    const response = new EventEmitter() as FakeResponse & { statusCode: number; headers: IncomingHttpHeaders };
    response.statusCode = spec.status;
    response.headers = spec.headers ?? {};
    response.destroyed = false;
    response.destroy = vi.fn(() => { response.destroyed = true; events.push(`destroy:${url.pathname}`); queueMicrotask(() => request.emit('close')); return response; });
    response.resume = vi.fn(() => response);
    responses.push(response);
    request.end = () => queueMicrotask(() => {
      callback(response as unknown as IncomingMessage);
      if (!response.destroyed && spec.status >= 200 && spec.status < 300) {
        response.emit('data', Buffer.from(spec.body ?? 'Readable source content.'));
        response.emit('end');
        request.emit('close');
      }
    });
    request.destroy = error => { if (error) request.emit('error', error); request.emit('close'); };
    return request;
  });
}

beforeEach(() => {
  network.lookup.mockReset(); network.request.mockReset(); responses.length = 0; events.length = 0;
  network.lookup.mockResolvedValue([{ address: '1.1.1.1', family: 4 }]);
});

describe('bounded response handling with mocked public DNS and transport', () => {
  it('destroys a redirect body before following and revalidates the next public target', async () => {
    installResponses([
      { status: 302, headers: { location: '/final', 'content-length': '999999999' } },
      { status: 200, headers: { 'content-type': 'text/plain' }, body: 'Collected final source.' },
    ]);
    const source = await collectSource('https://public.example/start', 0);
    expect(source.url).toBe('https://public.example/final');
    expect(source.content).toBe('Collected final source.');
    expect(events.slice(0, 3)).toEqual(['request:/start', 'destroy:/start', 'request:/final']);
    expect(responses[0].destroy).toHaveBeenCalledOnce();
    expect(responses[0].resume).not.toHaveBeenCalled();
    expect(responses[0].listenerCount('data')).toBe(0);
    expect(network.lookup).toHaveBeenCalledTimes(2);
    expect(network.lookup).toHaveBeenNthCalledWith(2, 'public.example', { all: true, verbatim: true });
  });

  it.each([400, 404, 500, 503])('immediately destroys HTTP %i bodies instead of draining them', async status => {
    installResponses([{ status, headers: { 'content-length': '999999999' } }]);
    await expect(collectSource('https://public.example/error', 0)).rejects.toThrow(`HTTP ${status}`);
    expect(responses[0].destroy).toHaveBeenCalledOnce();
    expect(responses[0].resume).not.toHaveBeenCalled();
    expect(responses[0].listenerCount('data')).toBe(0);
    expect(network.request).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed Location as a promise failure after closing the response', async () => {
    installResponses([{ status: 302, headers: { location: 'http://[invalid' } }]);
    await expect(collectSource('https://public.example/broken', 0)).rejects.toThrow('Redirect has an invalid destination.');
    expect(responses[0].destroy).toHaveBeenCalledOnce();
    expect(responses[0].resume).not.toHaveBeenCalled();
    expect(network.request).toHaveBeenCalledTimes(1);
  });

  it('closes a redirect without Location and rejects it', async () => {
    installResponses([{ status: 301 }]);
    await expect(collectSource('https://public.example/missing', 0)).rejects.toThrow('Redirect has no destination.');
    expect(responses[0].destroy).toHaveBeenCalledOnce();
    expect(responses[0].resume).not.toHaveBeenCalled();
  });

  it('still blocks a redirect to a private address before making another request', async () => {
    installResponses([{ status: 307, headers: { location: 'http://127.0.0.1/private' } }]);
    await expect(collectSource('https://public.example/redirect', 0)).rejects.toThrow('non-public addresses are blocked');
    expect(responses[0].destroy).toHaveBeenCalledOnce();
    expect(network.request).toHaveBeenCalledTimes(1);
    expect(network.lookup).toHaveBeenCalledTimes(1);
  });

  it('checks DNS again on redirects and rejects a non-public result without transport', async () => {
    network.lookup.mockReset();
    network.lookup.mockResolvedValueOnce([{ address: '1.1.1.1', family: 4 }]).mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }]);
    installResponses([{ status: 302, headers: { location: 'https://other-public.example/final' } }]);
    await expect(collectSource('https://public.example/start', 0)).rejects.toThrow('DNS includes a private');
    expect(responses[0].destroy).toHaveBeenCalledOnce();
    expect(network.lookup).toHaveBeenCalledTimes(2);
    expect(network.request).toHaveBeenCalledTimes(1);
  });
});
