# apps/web

Vite + React 19 SPA with react-router and Tailwind v4. Deploys as a Render
static site (see the `render-deploys` skill).

- Add pages in `src/pages/` and register them in `src/routes.tsx`;
  `App.tsx` stays a pure layout shell.
- Fetch the API by relative path (`/api/...`). Vite's dev proxy and the
  static site's prod `/api/*` rewrite both depend on it.
- Standalone `tsconfig.json` (bundler resolution, `noEmit`) that does not
  extend the root NodeNext config. `build` runs `tsc --noEmit` first, so type
  errors fail the build.
- Tests run under jsdom, configured in `vite.config.ts`.
