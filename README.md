# Rapha AI Agents

Monorepo for LLM-powered agents and API services built with TypeScript, Hono, and Vercel AI SDK.

## Structure

```
/
├── api/
│   ├── Dockerfile           # API Docker image
│   ├── index.ts             # Server entry point
│   └── ...                  # Endpoints, schedulers, UI
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

PostgreSQL ORM used by the API. Schema: `prisma/schema.prisma`. Config: `prisma.config.ts` (reads `DATABASE_URL` from env).

**Setup**
```bash
# After schema changes (either form works)
npm run prisma:generate   # or: npx prisma generate
# Optional: run migrations (when prisma/migrations exist)
npx prisma migrate deploy
```

**Usage**  
Import the client and types from the db layer: `api/db/prisma.ts` exports `prisma`, and re-exports `MemoryEntry`, `User`, `Prisma`. Use `api/db/memoryEntry.ts` and `api/db/user.ts` for model operations. In CI or Docker, run `prisma generate` before typecheck or start.

## Deployment (Dokploy)

### API Application

**Type:** Application (From Git)

**Build:**
- Build Method: **Dockerfile**
- Docker File: `api/Dockerfile`
- Docker Context Path: `.` (repo root)

**Watch Paths:**
```
api/**
libs/**
```

**Environment Variables:**
- `PORT=3000` (auto-set by Dokploy)
- `BASE_URL` (e.g., https://api.raphastudio.com)
- `POE_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `API_KEY`
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_CSE_ID`
- Optional: `YOUTUBE_COOKIE`, `OXYLABS_USERNAME`, `OXYLABS_PASSWORD`

**Domain:** `api.raphastudio.com`

### OWUI (Open WebUI)

**Type:** Compose

**Compose File:** `owui/docker-compose.yml`

**Watch Paths:** `owui/**`

**Environment Variables:**
- `WEBUI_SECRET_KEY`
