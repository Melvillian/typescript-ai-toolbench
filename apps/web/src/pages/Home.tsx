import { useEffect, useState } from 'react';

type ApiState =
  | { status: 'loading' }
  | { status: 'ok'; message: string }
  | { status: 'error'; detail: string };

export default function Home() {
  const [api, setApi] = useState<ApiState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/hello');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as { message: string };
        if (!cancelled) {
          setApi({ status: 'ok', message: body.message });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setApi({
            status: 'error',
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Home</h1>
      <p className="mb-2">
        This starter page calls <code>GET /api/hello</code> on the Hono server
        to prove the web → api wiring:
      </p>
      {api.status === 'loading' && <p className="text-gray-500">Loading…</p>}
      {api.status === 'ok' && (
        <p className="rounded border border-green-200 bg-green-50 p-3">
          API says: <strong>{api.message}</strong>
        </p>
      )}
      {api.status === 'error' && (
        <p className="rounded border border-red-200 bg-red-50 p-3">
          API call failed ({api.detail}). In dev, make sure the api server is
          running: <code>bun run dev</code> starts both processes.
        </p>
      )}
    </section>
  );
}
