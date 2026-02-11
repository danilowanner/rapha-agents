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
