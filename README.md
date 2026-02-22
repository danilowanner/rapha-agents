# Rapha AI Agents

Monorepo for LLM-powered agents and API services built with TypeScript, Hono, and Vercel AI SDK.

## Structure

```
/
├── api/
│   ├── Dockerfile           # API Docker image
│   ├── index.ts             # Server entry point
│   ├── handlers/            # Route handlers (bus, chat, summarize, wordsmith, responses/*)
│   ├── features/            # Shared API features (scheduler, memory)
│   └── ...                  # UI, db, tests
├── carousell/               # Carousell automation agent (Browser MCP)
├── owui/
│   └── docker-compose.yml   # Open WebUI deployment
├── libs/                    # Shared utilities (ai, context, utils)
├── test/                    # Tests
├── package.json             # Root dependencies
└── tsconfig.json            # Shared TypeScript config
```

## Local Development

```bash
npm install
npm run start-api-dev      # API server (watch mode)
npm run start-carousell-dev # Carousell agent (watch mode)
```

## Prisma

Schema: `prisma/schema.prisma`. Config: `prisma.config.ts` (uses `DATABASE_URL`).

- **After schema change:** `npx prisma migrate dev --name <name>` (creates migration), then `npm run prisma:generate`.
- **Prod:** After deploy, run migrations: `npx prisma migrate deploy` (shell script in tasks.json).
- **Usage:** `api/db/prisma.ts` exports `prisma`, `MemoryEntry`, `User`, `Prisma`. Use `api/db/memoryEntry.ts`, `api/db/user.ts`.

## Deployment (Dokploy)

### API Application

**Type:** Application (From Git)

**Build:**

- Build Method: **Dockerfile**
- Docker File: `api/Dockerfile`
- Docker Context Path: `.` (repo root)

**Watch Paths:** `api/**`, `libs/**`, `prisma/**`

**Env:** `PORT`, `BASE_URL`, `DATABASE_URL`, `POE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `API_KEY`, `BRAVE_SEARCH_API_KEY`. Optional: `YOUTUBE_COOKIE`, `OXYLABS_*`.
**Domain:** api.raphastudio.com

### OWUI

**Type:** Compose.
**File:** `owui/docker-compose.yml`.
**Watch:** `owui/**`.
**Env:** `WEBUI_SECRET_KEY`.
