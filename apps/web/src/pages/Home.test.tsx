import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Home from './Home';

// A fetch that stays pending until the test settles it, to land a response
// after the component has unmounted.
const deferredFetch = () => {
  let settle: {
    resolve: (res: Response) => void;
    reject: (reason: unknown) => void;
  } = { resolve: () => undefined, reject: () => undefined };
  const promise = new Promise<Response>((resolve, reject) => {
    settle = { resolve, reject };
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => promise),
  );
  return settle;
};

const flushPromises = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), init);

describe('Home', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a loading state, then the message from GET /api/hello', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'hi from api' }));
    vi.stubGlobal('fetch', fetchMock);

    render(<Home />);

    expect(screen.getByText('Loading…')).toBeDefined();
    expect(await screen.findByText('hi from api')).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/hello');
  });

  it('shows the HTTP status when the api responds with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({}, { status: 503 })),
    );

    render(<Home />);

    expect(
      await screen.findByText(/API call failed \(HTTP 503\)/),
    ).toBeDefined();
  });

  it('stringifies non-Error rejections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('network down'));

    render(<Home />);

    expect(
      await screen.findByText(/API call failed \(network down\)/),
    ).toBeDefined();
  });

  it('ignores a successful response that lands after unmount', async () => {
    const pendingFetch = deferredFetch();
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const { unmount } = render(<Home />);
    unmount();
    pendingFetch.resolve(jsonResponse({ message: 'too late' }));
    await flushPromises();

    expect(screen.queryByText('too late')).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it('ignores a failure that lands after unmount', async () => {
    const pendingFetch = deferredFetch();

    const { unmount } = render(<Home />);
    unmount();
    pendingFetch.reject(new Error('too late'));
    await flushPromises();

    expect(screen.queryByText(/API call failed/)).toBeNull();
  });
});
