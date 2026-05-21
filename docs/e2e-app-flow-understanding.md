# ContentSpark App Flow Understanding (E2E)

## Scope
This document captures the authenticated product flow as a split E2E suite, not a single long scenario. The suite is organized into focused blocks:
1. profile and brand setup
2. persona setup
3. backlog/manual idea planning
4. scheduling and persistence
5. lightweight cross-flow smoke coverage

## High-level Architecture
- Frontend: React + Vite + TypeScript
- Auth/Profile source: Supabase Auth + `rpc/get_my_profile`
- Data persistence: Supabase Postgres via REST helper and services
- Core state boundaries:
  - Auth state: `src/context/AuthContext.tsx`
  - Team/workspace state: `src/context/TeamContext.tsx`
  - Dashboard data loading/filtering: `src/hooks/useDashboardData.ts`
  - Idea generation/edit/persist: `src/hooks/useIdeaManagement.ts`
  - Scheduling DnD: `src/hooks/useDragAndDrop.ts`

## Suite Structure
### 1) Profile and strategy setup
- Spec: `tests/profile-settings.spec.ts`
- Verifies profile identity updates.
- Verifies brand kit updates.
- Verifies persona creation from the profile workspace.

### 2) Content planning workflows
- Spec: `tests/content-planning.spec.ts`
- Verifies manual idea creation from backlog.
- Verifies scheduling an existing idea and persisting date/time.

### 3) Cross-flow smoke coverage
- Spec: `tests/full-app-flow.spec.ts`
- Verifies the user can move from setup-oriented screens back into planning entry points.
- Keeps broad navigation confidence without duplicating all detailed assertions.

## Verified User Journey
### 1) Authenticated dashboard entry
- User lands on `/app` with fixture-authenticated session.
- Sidebar and calendar render.

### 2) Profile setup
- Opens profile from the sidebar bottom account button.
- Updates first/last name.
- Uploads avatar file to storage bucket (`avatars`).

### 3) Brand kit setup
- Adds and edits brand colors.
- Updates style text.
- Saves profile + brand kit from profile page.

### 4) Target persona setup
- Uses persona selector to create a new persona.
- Fills persona name and description.
- Saves strategy profile.

### 5) Credits handling
- Credits are topped up before generation or cross-flow transitions when needed (`resetUserCredits` in test flow).
- Additional script available for explicit top-up:
  - `npm run test:credits -- --email blbacelar@gmail.com --credits 50`
- Playwright config now prefers `TEST_*` Supabase env vars first to avoid environment mismatch during tests.
- Playwright execution is intentionally non-parallel because these tests reuse a shared authenticated account and shared cleanup.

### 6) Idea creation path
- Primary path: open Strategy Engine, fill topic/audience/persona, trigger generation.
- Fallback path (if strategy button remains unavailable): create manual idea from sidebar and continue flow.

### 7) Scheduling
- Opens idea modal.
- Sets future date and time.
- Saves and verifies calendar entry is visible.

### 8) Persistence verification
- Service-role DB assertion verifies saved idea has expected `date` and `time` for the test user.

## Reliability Notes
- Strategy button availability can be sensitive to profile credit state propagation.
- Test includes bounded retries and fail-fast checkpoints to avoid hanging behavior.
- Cleanup resets test data and credits after execution.

## Main E2E Artifacts
- Test helper module: `tests/app-flow.helpers.ts`
- Focused setup spec: `tests/profile-settings.spec.ts`
- Focused planning spec: `tests/content-planning.spec.ts`
- Cross-flow smoke spec: `tests/full-app-flow.spec.ts`
- Avatar fixture used by the test: `tests/fixtures/avatar.svg`
- Credits utility script: `scripts/add-test-credits.mjs`
