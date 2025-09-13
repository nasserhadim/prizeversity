# Dev Environment Test – 2025-09-09

## Goals
- Ensure repo installs and runs locally for all teammates
- Verify VS Code tooling (extensions, formatting, debugging)
- Confirm branch workflow and permissions

## What I tested
- Clone + checkout personal branch:
  - git fetch origin
    - git checkout -b jake-branch origin/jake-branch (or create if needed)
- Install:
  - root: npm ci (or yarn/pnpm as project uses)
  - server: npm ci && npm run dev (confirm localhost:PORT responds)
  - client: npm ci && npm start (confirm UI loads)
- Env:
  - Verified example .env files exist and app reads vars
- Git flow:
  - Merged latest `testing-branch` into `jake-branch` (no conflicts)
  - Confirmed pushing to `jake-branch` does not affect `testing-branch`

## Results (Jake)
- ✅ Install succeeded
- ✅ Server starts locally
- ✅ Client starts locally
- ✅ API reachable from client
- ✅ VS Code formatting & eslint active
- ✅ Debugging launches (where configured)

## Notes / minor fixes
- [Add any quick fixes you did or observed, or leave blank]

## Next steps
- Proceed with leveling system planning (Wed)
- Pseudocode doc (Thu)
- Start Requirement 4 code (Fri)