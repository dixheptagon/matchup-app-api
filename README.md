# MatchUp API

Backend for **MatchUp**, a multi-tenant racket-sport club and matchmaking platform. It manages clubs, members, courts, sessions, player check-in and rest state, automatic/manual matchmaking, the match lifecycle, and per-session statistics.

> **Current scope:** matchmaking is doubles only (2v2, four players per match). Singles are not implemented.

**Stack:** NestJS 12 · TypeScript (ESM) · Prisma 7 + PostgreSQL · Vitest · pnpm

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Docker](#docker)
- [Project structure](#project-structure)
- [Domain overview](#domain-overview)
- [API conventions](#api-conventions)
- [Testing and scripts](#testing-and-scripts)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

## Quick start

### Prerequisites

- Node.js 24+
- pnpm 12.3.4 (enabled through Corepack)
- PostgreSQL 18, locally or through the Docker setup below

### 1. Install dependencies

```bash
corepack enable
pnpm install
```

### 2. Configure the environment

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set at least:

- `PORT` — must be numeric, e.g. `8000`
- `URL` — public base URL of the API; also used as the allowed CORS origin
- `DATABASE_URL` — the PostgreSQL connection string Prisma uses
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` — the public callback for this API, e.g. `http://localhost:8000/api/auth/google/callback`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — random strings of 32+ characters

See [Environment variables](#environment-variables) for the full list.

### 3. Start PostgreSQL

With Docker, run this **from the repository root** (the directory containing `compose.yaml`):

```bash
docker compose up -d db
```

If you already run PostgreSQL locally, create the user/database matching `DATABASE_URL` instead.

### 4. Prepare the database

```bash
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm prisma:seed
```

The Prisma client is generated into `prisma/generated/` and is gitignored, so `prisma generate` is required after cloning and after every schema change. `pnpm install` does not generate it.

### 5. Run the API

```bash
pnpm start:dev
```

Verify it is up:

```bash
curl http://localhost:8000/api
# Hello World!
```

The API is served under `http://localhost:8000/api`. The root route returns plain text and is not wrapped in the usual response envelope.

## Environment variables

Validation is performed by Zod at startup (`src/config/env/env.config.ts`); the process exits with `Invalid environment variables` when a required value is missing or malformed.

| Variable                        | Required | Default       | Purpose                                                                                                    |
| ------------------------------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                      | no       | `development` | `development`, `production`, or `test`                                                                     |
| `PORT`                          | no       | `8000`        | HTTP port; must be a number                                                                                |
| `URL`                           | yes      | —             | Public base URL of the API; allowed CORS origin                                                            |
| `DB_USER`                       | yes      | —             | PostgreSQL user used by Docker Compose                                                                     |
| `DB_PASSWORD`                   | yes      | —             | PostgreSQL password used by Docker Compose                                                                 |
| `DB_NAME`                       | yes      | —             | PostgreSQL database name used by Docker Compose                                                            |
| `DATABASE_URL`                  | yes      | —             | Connection string read by Prisma                                                                           |
| `DB_TEST_NAME`                  | no       | —             | Test database name used by the `db-test` Compose service                                                   |
| `DATABASE_TEST_URL`             | no       | —             | Connection string E2E tests use instead of `DATABASE_URL`                                                  |
| `GOOGLE_CLIENT_ID`              | yes      | —             | Google OAuth client ID                                                                                     |
| `GOOGLE_CLIENT_SECRET`          | yes      | —             | Google OAuth client secret                                                                                 |
| `GOOGLE_CALLBACK_URL`           | yes      | —             | Google redirect URI; must point at `.../api/auth/google/callback` and match the Google Cloud Console entry |
| `JWT_ACCESS_SECRET`             | yes      | —             | Access-token signing secret (32+ chars)                                                                    |
| `JWT_REFRESH_SECRET`            | yes      | —             | Refresh-token signing secret (32+ chars)                                                                   |
| `JWT_ACCESS_EXPIRATION`         | yes      | —             | Access-token lifetime, e.g. `15m`                                                                          |
| `JWT_REFRESH_EXPIRATION`        | yes      | —             | Refresh-token lifetime, e.g. `7d`                                                                          |
| `USERNAME_CHANGE_COOLDOWN_DAYS` | no       | `0`           | Days between username changes; `0` disables the cooldown                                                   |

### `.env` vs `.env.local`

- The application loads **`.env`** only (`ConfigModule` is configured with `envFilePath: '.env'`).
- The `db:studio`, `db:reset`, and `prisma:local` scripts preload **`.env.local`** through `dotenv-cli`. Create that file when you use those scripts.
- `prisma.config.ts` loads `.env` for Prisma CLI commands.

## Docker

The Compose file lives at the repository root, not inside `matchup-api/`. It defines:

| Service   | Port(s) | Notes                                                      |
| --------- | ------- | ---------------------------------------------------------- |
| `api`     | `8000`  | Built from `matchup-api/Dockerfile`, runs `pnpm start:dev` |
| `db`      | `5432`  | PostgreSQL 18, development database                        |
| `db-test` | `5433`  | PostgreSQL 18, E2E database                                |
| `adminer` | `8080`  | Database UI                                                |

Compose reads `matchup-api/.env`; that file must exist before any Compose command.

```bash
# From the repository root
docker compose up --build          # api, db, db-test, adminer
docker compose up --build api      # api + its db dependency only
docker compose watch               # same, with source sync
docker compose down
```

Notes:

- `docker compose watch` (or `docker compose up --watch`) enables the source sync configured in `compose.yaml`. A plain `up` does not sync local edits into the container.
- When the API runs inside Docker, `DATABASE_URL` must reach PostgreSQL through the service name, e.g. `postgresql://user:password@db:5432/matchup-db`. `localhost` inside the container refers to the API container itself.
- Run migrations inside the API container after changing the schema: `pnpm prisma:docker pnpm exec prisma migrate dev` (from the repository root).
- Adminer: <http://localhost:8080> — system `PostgreSQL`, server `db`, credentials from `.env`.

## Project structure

```text
matchup-api/
├─ prisma/
│  ├─ schema.prisma            # Source of truth for the data model
│  ├─ migrations/
│  ├─ seed.ts                  # Entry point for `pnpm prisma:seed`
│  └─ seeds/
├─ src/
│  ├─ auth/                    # Google OAuth, JWT access/refresh tokens
│  ├─ users/                   # Current-user profile
│  ├─ sport-clubs/             # Club CRUD and ownership
│  ├─ sport-members/           # Members, roles, RolesGuard
│  ├─ sport-courts/            # Club-level courts
│  ├─ club-settings/           # Club defaults and matchmaking presets
│  ├─ sport-sessions/
│  │  ├─ sport-sessions.controller.ts
│  │  ├─ sessions.public.controller.ts
│  │  ├─ dto/
│  │  ├─ shared/               # Constants, guards, decorators, helpers, types
│  │  └─ sub-modules/
│  │     ├─ courts/            # Courts attached to a session
│  │     ├─ settings/          # Per-session settings snapshot
│  │     ├─ players/           # Draft roster, check-in, rest/BREAK, eligibility
│  │     ├─ matches/           # Auto/manual matchmaking, lifecycle, composition
│  │     └─ stats/             # Per-player session stats and leaderboard
│  ├─ common/                  # Exception filter, response interceptor, middleware, validators
│  ├─ config/                  # Environment validation and Prisma module
│  ├─ app.module.ts
│  └─ main.ts
├─ test/                       # E2E specs and shared setup helpers
├─ vitest.config.ts
└─ vitest.config.e2e.ts
```

## Domain overview

**Entity flow**

```text
User ──< SportClub ──< ClubMember
                  ├──< Court
                  ├──  ClubSettings
                  └──< SportSession ──  SessionSettings
                                      ├──< SessionCourt
                                      ├──< SessionPlayer ──  SessionPlayerStat
                                      └──< SessionMatch ──< MatchPlayer
                                                        └──  MatchResult
```

**Roles.** A club owner is the `SportClub.ownerId` user and is treated as `OWNER`. Club members hold `ADMIN` or `MEMBER` in `ClubMember.role`. `RolesGuard` resolves the club from the `:clubSlug` route parameter; session routes additionally use `SessionGuard` to verify the session belongs to the club and is in an allowed status.

**Player status**

| Status        | Meaning                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| `NOT_ARRIVED` | On the session roster, not checked in                                                        |
| `WAITING`     | Checked in and available                                                                     |
| `RESERVED`    | Held by a queued/ready match                                                                 |
| `PLAYING`     | Currently on court                                                                           |
| `RESTING`     | Cooldown after a match or a timed manual rest; promoted to `WAITING` once `restUntil` passes |
| `BREAK`       | Manual break (timed or indefinite); never auto-selected                                      |
| `LEFT`        | Checked out / left the session                                                               |

**Match status**

| Status      | Meaning                                                                                |
| ----------- | -------------------------------------------------------------------------------------- |
| `QUEUED`    | Created without a court                                                                |
| `READY`     | Court assigned; the session court is `IN_USE`                                          |
| `PLAYING`   | Started; players are `PLAYING`                                                         |
| `FINISHED`  | Result recorded; players return to `RESTING` or `WAITING`, court is freed              |
| `CANCELLED` | Soft-cancelled while `PLAYING` (with reason); queued/ready matches are deleted instead |

**Session status.** Sessions start as `DRAFT` and become `ACTIVE` through the start endpoint, which requires at least one session court and four players. `FINISHED` and `ARCHIVED` exist in the schema, but no HTTP endpoint currently transitions to them. Session details can only be changed or deleted while `DRAFT`.

**Matchmaking.** Auto-matchmaking prefers the `WAITING` pool and falls back to `RESTING` players only when fewer than four are waiting. Manual matches accept any `WAITING` or `RESTING` player. `BREAK`, `PLAYING`, `RESERVED`, `NOT_ARRIVED`, and `LEFT` players are never selected. Selection uses fairness weighting (play counts, waiting time, late-joiner policy) and team composition priorities (balance, skill band, gender preference) from the session settings snapshot. Auto-match runs under a per-session PostgreSQL advisory lock to prevent double-booking. Rest and break expiry is evaluated lazily when players are read or matched; there is no background scheduler.

Each session snapshots club settings at creation. Many settings become read-only once the session is `ACTIVE`; see `src/sport-sessions/sub-modules/settings/` for the exact rules.

## API conventions

- **Base path:** `/api` (for example `http://localhost:8000/api`).
- **Authentication:** protected routes expect `Authorization: Bearer <accessToken>`. Tokens are issued by the Google OAuth callback; refresh and logout use the refresh token.
- **Auth routes:** `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.
- **Validation:** a global `ValidationPipe` runs with `whitelist` and `forbidNonWhitelisted`, so unknown body properties return `400`.
- **Guards:** `JwtAuthGuard` → `RolesGuard` (`:clubSlug`) → `SessionGuard` (`:sessionId` plus allowed session statuses).

Success responses:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": {},
  "requestId": "..."
}
```

Paginated responses move the payload into `data` and add `meta`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": [],
  "meta": { "total": 0 },
  "requestId": "..."
}
```

Errors:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "data": ["name must be a string"],
  "requestId": "...",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/...",
  "method": "POST"
}
```

Internal (5xx) details and stacks are hidden outside `development`. `204 No Content` responses and the root `GET /api` route are not wrapped.

### Where to find endpoints

There is no Swagger/OpenAPI document; controllers and DTOs are the contract.

| Area                                 | Controller                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Auth                                 | `src/auth/auth.controller.ts`                                                                         |
| Users                                | `src/users/users.controller.ts`                                                                       |
| Clubs                                | `src/sport-clubs/sport-clubs.controller.ts`                                                           |
| Members                              | `src/sport-members/sport-members.controller.ts`                                                       |
| Courts                               | `src/sport-courts/sport-courts.controller.ts`                                                         |
| Club settings                        | `src/club-settings/club-settings.controller.ts`                                                       |
| Sessions                             | `src/sport-sessions/sport-sessions.controller.ts`, `src/sport-sessions/sessions.public.controller.ts` |
| Session courts                       | `src/sport-sessions/sub-modules/courts/session-courts.controller.ts`                                  |
| Session settings                     | `src/sport-sessions/sub-modules/settings/session-settings.controller.ts`                              |
| Players, check-in, rest, eligibility | `src/sport-sessions/sub-modules/players/*.controller.ts`                                              |
| Matches                              | `src/sport-sessions/sub-modules/matches/session-matches.controller.ts`                                |
| Stats                                | `src/sport-sessions/sub-modules/stats/session-stats.controller.ts`                                    |

The data model is defined in [`prisma/schema.prisma`](prisma/schema.prisma). Matchmaking logic lives in `src/sport-sessions/sub-modules/matches/services/`, and shared limits/weights in `src/sport-sessions/shared/constants/sport-sessions.constant.ts`.

## Testing and scripts

Unit tests use Vitest with mocked dependencies and do not need a database:

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
pnpm test:cov      # coverage
```

E2E tests boot the real application against a PostgreSQL test database:

1. Start the test database from the repository root: `docker compose up -d db-test`.
2. Set `DATABASE_TEST_URL` in `.env`, e.g. `postgresql://user:password@localhost:5433/matchup-db-test`. Compose exposes `db-test` on host port `5433`.
3. Apply the schema to that database by temporarily pointing `DATABASE_URL` at it and running `pnpm exec prisma migrate deploy`, then restore `DATABASE_URL`.
4. Run `pnpm test:e2e`.

`vitest.config.e2e.ts` loads `.env` and replaces `DATABASE_URL` with `DATABASE_TEST_URL` for the run.

| Command                              | Description                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `pnpm start:dev`                     | Run in watch mode                                      |
| `pnpm start`                         | Run once                                               |
| `pnpm build`                         | Compile to `dist/`                                     |
| `pnpm start:prod`                    | Run the compiled app                                   |
| `pnpm lint`                          | Lint `src/` and `test/` with oxlint                    |
| `pnpm format`                        | Format with Prettier                                   |
| `pnpm exec prisma generate`          | Generate the Prisma client                             |
| `pnpm exec prisma migrate dev`       | Create and apply a development migration               |
| `pnpm prisma:seed`                   | Seed the database                                      |
| `pnpm db:studio`                     | Open Prisma Studio on port `51212` (uses `.env.local`) |
| `pnpm db:reset`                      | Reset the database (uses `.env.local`)                 |
| `pnpm prisma:local prisma <command>` | Run a Prisma command with `.env.local` loaded          |
| `pnpm prisma:docker <command>`       | Run a command in the `api` container                   |

## Troubleshooting

- **`Invalid environment variables`** — a required variable is missing or empty; `PORT` must be numeric and `NODE_ENV` must be `development`, `production`, or `test`.
- **Prisma client errors or missing enums** — run `pnpm exec prisma generate`; the generated client is not committed.
- **Compose cannot find the env file** — `matchup-api/.env` must exist, and Compose commands run from the repository root.
- **The API container cannot reach PostgreSQL** — use the `db` service name in `DATABASE_URL` (`...@db:5432/...`), not `localhost`.
- **Port already in use** — the defaults are `8000` (API), `5432` (`db`), `5433` (`db-test`), `8080` (Adminer).
- **pnpm warns about ignored build scripts** — run `pnpm ap` (`pnpm approve-builds`).
- **`db:studio` or `db:reset` fails** — these scripts read `.env.local`; create it or use plain `pnpm exec prisma ...` with `.env`.
- **Google `redirect_uri_mismatch`** — `GOOGLE_CALLBACK_URL` must be the exact API callback, including `/api/auth/google/callback`, and must be registered in Google Cloud Console.

## Known limitations

- Doubles only: 2v2 with four players per match. Singles and mixed formats are not supported.
- No endpoint finishes or archives a session; `FINISHED` and `ARCHIVED` are currently unused by the API.
- `partnerVariety` and `opponentVariety` are stored in settings but not consumed by the matchmaking engine.
- Rest and break expiry relies on demand-driven promotion; there is no scheduled job.
- No OpenAPI/Swagger document is generated.

## License

`UNLICENSED` — private project.
