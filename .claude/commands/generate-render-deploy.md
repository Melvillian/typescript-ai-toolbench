---
description: Add a render.yaml service entry (static site or Docker web service) for an app in apps/
arguments:
  - name: app-name
    description: Name of the app directory under apps/ (e.g. my-service)
    required: true
---

Add Render CD deployment capability to the app `apps/$ARGUMENTS.app-name`.

## Steps

1. First, verify that `apps/$ARGUMENTS.app-name` exists. If it doesn't, stop and tell the user.

2. **Decide static site vs web service.** Read the `render-deploys` skill and
   run its decision heuristic against this app. Default to a static site;
   only choose a Docker web service if the app genuinely needs a server at
   request time (it implements API routes, SSR, request-time secrets, etc.).
   Tell the user which you chose and why.

3. Build the generators workspace (required before running the CLI):

   ```
   bun --filter generators build
   ```

4. Run the render-deploy generator.

   For a **static site** (the default for frontend apps):

   ```
   bun generators/bin/generator.js render-deploy $ARGUMENTS.app-name --static
   ```

   For a **Docker web service**:

   ```
   bun generators/bin/generator.js render-deploy $ARGUMENTS.app-name
   ```

5. Verify the generated files:

   Static site:
   - The root `render.yaml` has a new entry with `runtime: static`,
     `staticPublishPath: apps/$ARGUMENTS.app-name/dist`, and an SPA-fallback
     rewrite. No Dockerfile is generated.
   - If the app fetches same-origin `/api/*` from a sibling web service,
     remind the user to fill in the commented `/api/*` rewrite with that
     service's real `.onrender.com` URL after its first deploy.

   Web service:
   - `apps/$ARGUMENTS.app-name/Dockerfile` (node:24 builder, runs under bun)
   - The root `render.yaml` has a new service entry for `$ARGUMENTS.app-name`
     with `healthCheckPath: /health`

   Note: the generator does NOT write a per-app `.dockerignore` — the build
   context is the repo root, so the root `.dockerignore` governs.

6. Show the user what was generated and remind them of next steps:
   - If this is the first service in render.yaml, they need a one-time Blueprint
     setup in the Render dashboard
   - Otherwise, just `git push origin main` to deploy
