# apps/api

Hono on Bun. `src/app.ts` exports a runtime-agnostic `createApp()` that tests
exercise via `app.request()`; `src/main.ts` is the `Bun.serve` entrypoint.

- API-only: it does not serve `apps/web`. In prod the Render static site's
  `/api/*` rewrite proxies here; in dev Vite proxies `/api` and `/health`
  to :8080. See the `render-deploys` skill.
- Hono's `/api/*` does not match bare `/api`, so both 404 handlers are
  registered on purpose.
- `PORT` defaults to 8080 and no `.env` is needed. Bun loads `.env` natively
  and real environment variables win. The Docker image sets `PORT=80`.
- Standalone `tsconfig.json` and `vitest.config.ts`; neither extends root.
