---
name: pnpm dependency isolation
description: Keep runtime packages used by the externalized API bundle declared by the API workspace.
---

When pnpm installs a workspace, an app must not rely on packages declared only at the repository root. Packages externalized by the API bundler remain runtime imports and must be declared in the API server's own dependencies.

**Why:** Root-level dependency hoisting can let builds pass while the built server fails to start because an externalized package is unavailable from the API workspace.

**How to apply:** When changing API bundler externals or runtime imports, compare the emitted imports with the API package's dependencies and run the built entry point to catch startup-only resolution failures.
