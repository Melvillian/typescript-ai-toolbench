---
description: Add a Render Dockerfile and a render.yaml service entry for an app in apps/
arguments:
  - name: app-name
    description: Name of the app directory under apps/ (e.g. my-service)
    required: true
---

Add Render CD deployment capability to the app `apps/$ARGUMENTS.app-name`.

## Steps

1. First, verify that `apps/$ARGUMENTS.app-name` exists. If it doesn't, stop and tell the user.

2. Build the generators package (required before running the CLI):

   ```
   cd generators && bun run build && cd ..
   ```

3. Run the render-deploy generator:

   ```
   bun generators/bin/generator.js render-deploy $ARGUMENTS.app-name
   ```

4. Verify the generated files exist:
   - `apps/$ARGUMENTS.app-name/Dockerfile` (node:24 builder, runs `node …/dist/main.js`)
   - The root `render.yaml` has a new service entry for `$ARGUMENTS.app-name`
     with `healthCheckPath: /health`

   Note: the generator does NOT write a per-app `.dockerignore` — the build
   context is the repo root, so the root `.dockerignore` governs.

5. Show the user what was generated and remind them of next steps:
   - If this is the first service in render.yaml, they need a one-time Blueprint
     setup in the Render dashboard
   - Otherwise, just `git push origin main` to deploy
