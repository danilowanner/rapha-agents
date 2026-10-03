# Rapha AI Agents

Monorepo for LLM-powered agents and API services built with TypeScript, TanStack Start, and Vercel AI SDK.

## Structure

```
/
├── api/
│   ├── Dockerfile           # API Docker image
│   ├── routes/              # UI and HTTP server routes
│   ├── server.ts            # TanStack Start server entry
│   ├── server.mjs           # Production Node server
│   ├── process.ts           # Background service lifecycle
│   ├── features/            # Reusable domain logic
│   ├── ui/                  # Shared UI and styles
│   └── ...                  # Database modules and tests
├── owui/
│   └── docker-compose.yml   # Open WebUI deployment
├── libs/                    # Shared utilities (ai, context, utils)
│   └── tsconfig.json        # Extends tsconfig.base.json, referenced by api
├── test/                    # Tests
├── package.json             # Root dependencies
└── tsconfig.base.json       # Shared compiler options only
```

## Local Development

```bash
npm install
npm run start-api-dev      # API server (watch mode)
```

## MCP

Grok Bot: Streamable HTTP `https://api.raphastudio.com/mcp`. Header `Authorization: Bearer <API_KEY>`. Stateless JSON.

Tools call the same functions as the OpenAPI tool server. MCP names: `web_research`, `fetch_youtube_transcript`, `ibkr_get_holdings`. `Fetch-Website` stays on OpenAPI only. Grok already fetches pages.

`ibkr_get_holdings` is read-only and is not on OpenAPI. `nlvBase` and `cashBase` are in `baseCurrency`. Each position has `description`, `isin`, `markPriceListing` and `marketValueListing` (`listingCurrency`), and `marketValueBase`.

Flex query needs Account Information, Equity Summary in Base, and Open Positions (`symbol`, `description`, `isin`, `position`, `markPrice`, `positionValue`, `currency`, `fxRateToBase`, `conid`). Env: `IBKR_FLEX_TOKEN`, `IBKR_FLEX_QUERY_ID`. Both required.

OWUI stays on `GET /tools/openapi.json` and `POST /tools/$name`. Do not add MCP-only tools (IBKR) to that OpenAPI registry.

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

**Env:** `PORT`, `BASE_URL`, `DATABASE_URL`, `POE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `API_KEY`, `BRAVE_SEARCH_API_KEY`. Optional: `YOUTUBE_COOKIE`, `OXYLABS_*`, `IBKR_FLEX_TOKEN`, `IBKR_FLEX_QUERY_ID`.
**Domain:** api.raphastudio.com

### OWUI

**Type:** Compose.
**File:** `owui/docker-compose.yml`.
**Watch:** `owui/**`.
**Env:** `WEBUI_SECRET_KEY`.
