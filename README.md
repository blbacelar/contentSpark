# ContentSpark

ContentSpark is a full-stack AI-assisted content planning workspace for solo creators, consultants, and small teams. It combines audience strategy, brand context, idea generation, scheduling, and team collaboration in a single React application backed by Supabase.

This is the project I would present as a portfolio piece for full-stack product engineering: it includes authentication, workspace-aware data modeling, AI orchestration through backend edge functions, bilingual UI, drag-and-drop scheduling, and end-to-end automation with Playwright.

## Demo

See the portfolio demo walkthrough in [docs/demo/README.md](docs/demo/README.md) for screenshots, a recorded product tour, and a concise explanation of the main user flows.

## What The Project Does

- Lets users define target personas and brand context to guide AI generation.
- Generates content ideas through OpenRouter-backed Supabase Edge Functions, keeping model credentials server-side.
- Persists ideas, personas, profiles, and team memberships in Supabase Postgres with Row Level Security.
- Organizes ideas in a backlog and drag-to-calendar scheduling workflow.
- Supports personal workspaces and shared team workspaces with invite flows.
- Protects authenticated routes and backend functions with Supabase Auth.
- Delivers the UI in English and Portuguese via i18next.

## Core Features

- **Authenticated workspace**: sign-up, login, and route protection via Supabase Auth; personal and team workspace switching.
- **AI idea generation**: the strategy form combines topic, audience, tone, and persona context and calls a backend edge function that returns structured content ideas.
- **Brand-kit analysis**: users can upload a brand-kit PDF; the backend extracts text and returns structured brand metadata through OpenRouter.
- **Backlog and calendar planning**: generated ideas land in a backlog and can be dragged onto a calendar to schedule them.
- **Team collaboration**: create teams, invite members, and scope all data to the active workspace.
- **Notifications**: in-app notification centre with a background polling hook.
- **Responsive UI**: modern interface built with React, Vite, Tailwind CSS, and Radix UI primitives.

## Architecture Overview

### Frontend

- React 18 + TypeScript single-page app
- Vite for development and production builds
- Tailwind CSS and Radix UI primitives
- React Context and custom hooks for auth, team state, data loading, and workflow logic
- dnd-kit for drag-and-drop interactions
- i18next for localization

### Backend

- Supabase Auth for login and session state
- Supabase Postgres for profiles, teams, personas, ideas, notifications, and settings
- Row Level Security for tenant data isolation
- Supabase Edge Functions for AI orchestration

### AI Layer

The frontend does not call the model provider directly. It invokes Supabase Edge Functions, and those functions call OpenRouter using server-side secrets. This keeps API keys out of the browser and centralizes provider logic.

## How It Works

1. A user signs up or signs in through the Supabase Auth flow.
2. The dashboard loads the user's workspace context — personal or team — and scopes all data accordingly.
3. The user fills in the strategy form with a topic, target audience, tone, and optional persona.
4. The frontend calls the `generate-content` Edge Function; the function calls OpenRouter and returns structured content ideas.
5. Ideas appear in the backlog and can be dragged onto the calendar to set a publish date.
6. Team members invited to the same workspace see the same ideas and can collaborate on planning.

## Data Model

The Supabase schema models the application around these entities:

- `profiles`: authenticated user accounts and settings
- `teams`: top-level workspace boundary
- `team_members`: membership link between users and teams
- `personas`: target audience definitions scoped to a workspace
- `content_ideas`: the main planning record with status, schedule date, and content body
- `notifications`: in-app activity feed per user

See `supabase/migrations/` for the full schema, RLS policies, and RPCs.

## Security And Operational Notes

- All authenticated routes and API calls are protected by Supabase Auth and Row Level Security.
- Edge Functions hold model provider credentials; no keys are exposed to the browser.
- The test suite uses a service-role admin client only in the test environment, never in production code.
- Team data is strictly scoped by workspace membership; users cannot read other teams' data.

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```dotenv
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CREATE_CHECKOUT_URL=optional_checkout_endpoint
```

### 3. Set Edge Function secrets

Inside the Supabase project used by the app:

```bash
supabase secrets set OPENROUTER_API_KEY=your_openrouter_api_key
supabase secrets set OPENROUTER_MODEL=openai/gpt-4o-mini
```

### 4. Apply the database schema

Apply all migrations under `supabase/migrations/` to the target Supabase project. The application expects the schema, policies, and RPCs defined there.

### 5. Start the app

```bash
npm run dev
```

## Useful Scripts

- `npm run dev`: run the Vite development server
- `npm run build`: build the app for production
- `npm run test:e2e`: run the full Playwright end-to-end suite
- `npm run demo:record`: record the portfolio demo walkthrough

### Test environment

Authenticated tests and the demo recording use `.env.test` with:

```dotenv
TEST_SUPABASE_URL=your_supabase_project_url
TEST_SUPABASE_KEY=your_supabase_anon_key
TEST_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TEST_USER_EMAIL=test-user@example.com
TEST_USER_PASSWORD=test-password
```

The recorded demo video is written to `test-results/` and copied to `docs/demo/contentspark-portfolio-demo.webm`.

## Portfolio Highlights

This project demonstrates:

- Full-stack TypeScript product design from landing page to authenticated workspace
- Server-side AI orchestration with no client-side model key exposure
- Multi-tenant collaboration model with team-aware data scoping and RLS
- Drag-and-drop scheduling UX built on dnd-kit
- Bilingual interface with i18next
- Playwright-based E2E automation plus a dedicated stable demo recording flow