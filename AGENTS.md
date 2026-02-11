You are an expert pair programmer. Your task is to help Danilo by executing code changes based on the context provided.

Danilo is a senior software engineer and architect with a strong preference for clean, efficient, and well-documented code.

When suggesting code changes, ensure that they are minimal and directly related to the recent edits. Do not suggest large refactors or unrelated changes.

## Communication style

Keep Danilo informed and avoid unnecessary verbosity to save his time.
Sacrifice grammar for the sake of concision.

## Project

Monorepo for LLM-powered agents and API services. Deployed on Dokploy with independent deployments per service.

Key packages within the project:

- api/ : Hono API server (api.raphastudio.com) with endpoints, schedulers, and response streaming. Dockerfile at `api/Dockerfile`.
- carousell/ : Agent that autonomously gathers data and fills forms in logged-in Chrome using Browser MCP.
- owui/ : Open WebUI deployment config (docker-compose).
- libs/ : Shared libraries and utilities used across different packages.

### Technilogy stack

- React
- Typescript
- Hono
- Vercel AI SDK
- Model Context Protocol (MCP)

### Library details

#### api/

Hono-based API server with scheduled tasks:

- **index.ts**: Main server setup with Hono, endpoints, and task registration
- **authHeaderMiddleware.ts**: Authentication middleware
- **bus.ts**: Bus endpoint handler
- **filename.ts**: Filename generation endpoint
- **summarize.ts**: Summarization endpoint
- **wordsmith.ts**: Wordsmith (writing) endpoint
- **transportDepartmentCheckHandler.ts**: Scheduled task for checking transport department appointments
- **scheduler.ts**: Task scheduler (registerTask, startScheduler, stopScheduler)

**Response streaming (responses/):**

- **state.ts**: ResponseBuffer class using EventEmitter for buffered stream replay. Exports addResponse, getResponseStream, getResponseResult, hasResponse, deleteResponse
- **md.ts**: Streams markdown chunks as plain text for client consumption
- **result.ts**: Returns complete result after stream finishes
- **view.tsx**: Response view renderer with SSR

**UI components (ui/):**

- **Document.tsx**: HTML document wrapper for SSR
- **MarkdownStream.tsx**: React component that fetches and renders streaming markdown using markdown-it
- **ResponseContainer.tsx**: Container component with root element ID

**Client (client/):**

- **main.tsx**: Client-side React hydration entry point
- **main.css**: Client styles
- **vite.config.ts**: Vite bundler config

#### carousell/

Browser automation agent using Model Context Protocol (MCP):

Core files:

- **agent.ts**: Main agent orchestration with task handling methods (handleDanilosMessage, updateListings, checkMessages, handleTask, pruneTasks)
- **mcp.ts**: Browser MCP client wrapper with methods like navigate(), goBack(), click(), type(), etc.
- **tools.ts**: AI tools wrapping MCP browser actions (browserNavigate, browserClick, browserType, browserSnapshot, etc.) and database operations
- **toolGroups.ts**: Organized tool groups (browserBasics, browserInteractions)
- **db.ts**: LowDB-based JSON database for listings, tasks, agent logs, and reasoning logs
- **system.ts**: System prompts for different contexts
- **scheduler.ts**: Task scheduling system
- **log.ts**: Logging utilities
- **shutdown.ts**: Graceful shutdown handling

Schemas (Zod validation):

- **schemas/listing.ts**: Carousell listing data structure
- **schemas/message.ts**: Message data structure
- **schemas/task.ts**: Task data structure
- **schemas/scheduleExecutionIn.ts**: Schedule timing configuration

Utils:

- **utils/callToolWithRetry.ts**: Retry logic for MCP tool calls
- **utils/createBackoff.ts**: Exponential backoff utility
- **utils/extractText.ts**: Text extraction from accessibility trees
- **utils/findElement.ts**: Element finding in accessibility trees
- **utils/getFirstToolMessage.ts**: Extract first tool message from MCP results
- **utils/getPageJsonSnapshot.ts**: JSON snapshot extraction
- **utils/getPageText.ts**: Page text extraction
- **utils/getPageTitle.ts**: Page title extraction
- **utils/getScheduleDelayMs.ts**: Schedule delay calculation
- **utils/getToolErrorMessage.ts**: Tool error message extraction
- **utils/getUnreadMessages.ts**: Unread message detection
- **utils/notify.ts**: User notification via Telegram
- **utils/scheduleSystemTask.ts**: System task scheduling

#### libs/ai

Core AI tooling that wraps the Vercel AI SDK's `tool()` function for agent capabilities:

- **fetchWebsiteTool.ts**: Tool for fetching and extracting website content, returning clean Markdown using Readability and Turndown
- **fetchYoutubeTranscriptTool.ts**: Tool for fetching YouTube video transcripts
- **reasoningTool.ts**: Tool for structured reasoning steps
- **sendMessageTool.ts**: Tool for sending messages to users via Telegram
- **sendResultTool.ts**: Tool for sending results with optional clipboard content via Telegram
- **providers/poe-provider.ts**: Custom Poe AI provider adapter
- **functions/extractFile.ts**: AI-based file metadata extraction using generateObject

#### libs/context

User context management for personalized agent interactions:

- **userContext.ts**: Contains user profiles (Danilo, Kian) with personal details, preferences, and context
- **getUserChatId.ts**: Retrieves Telegram chat IDs for users

#### libs/utils

Shared utilities:

- **telegram.ts**: Telegram bot instance using Grammy framework
- **markdownToTelegramHtml.ts**: Converts Markdown to Telegram-compatible HTML, stripping unsupported tags
- **createResponseStream.ts**: Streaming response utilities
- **fileToImageBuffers.ts**: File to image buffer conversion
- **fileToText.ts**: File to text conversion
- **formatDateTime.ts**: Formats date and time in "DD MMM YYYY, HH:MM" format
- **formatRelativeTime.ts**: Formats relative time (e.g., "5m ago", "2h ago", "3d ago")
- **isDefined.ts**: Type guard for defined values
- **jsonCodec.ts**: JSON encoding/decoding utilities
- **listCodec.ts**: List codec utilities
- **shorten.ts**: Text shortening utility
- **streamToString.ts**: Stream to string conversion
- **XmlBuilder.ts**: Simple XML builder class for readable XML generation with automatic escaping

#### libs/cli

Terminal UI components using Ink (React for CLI):

- **App.tsx**: Main CLI application component
- **index.tsx**: CLI entry point
- **store.ts**: State management for CLI
- **components/ScrollableLog.tsx**: Scrollable log display component
- **types/LogEntry.ts**: Log entry type definitions
- **types/LogLevel.ts**: Log level type definitions
- **utils/colors.ts**: Color utilities for terminal output

### Library guides

#### Poe provider usage

The Poe provider wraps various AI models. Usage pattern:

```typescript
import { generateObject, generateText } from "ai";
import { createPoeAdapter } from "../providers/poe-provider.ts";
import { env } from "../../env.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

// Use with generateText
const { text } = await generateText({
  model: poe("Claude-Haiku-4.5"),
  system: "...",
  messages: [{ role: "user", content: "..." }],
});

// Use with generateObject for structured output
const { object } = await generateObject({
  model: poe("Gemini-3-Flash"),
  schema: zodSchema,
  prompt: "...",
});
```

**Available models** (use exact string values):

- `"Claude-Sonnet-4.5"`, `"Claude-Haiku-4.5"`
- `"Gemini-3-Flash"`
- Full list in types of createPoeAdapter

## Deployment

### Structure

The monorepo uses path-based deployments on Dokploy:

- **API:** Dockerfile deployment (`api/Dockerfile`), watch paths: `api/**`, `libs/**`
- **OWUI:** Compose deployment (`owui/docker-compose.yml`), watch paths: `owui/**`
- **Shared:** Root `package.json`, `tsconfig.json` used by all services

Each service deploys independently based on watch paths.

## Source control

Do not use GIT to add or commit changes. Danilo will handle source control.

## Code style

Prefer Typescript with strong and strict typing to ensure reliability and maintainability.

Prefer functional programming paradigms and avoid side effects. Prefer `const` over `let` wherever possible.

When exporting a function, prefer named exports over default exports. Add a JSDoc with a brief description of the function's purpose.

### File contents order:

1. imports
2. constants
3. types and interfaces
4. main exports (components, functions)
5. private helper functions

IMPORTANT: Follow the order strictly. Main exports and higher-level constructs should be before private helper functions.

### Rules

- Prefer one-liner if statements when possible over block statements.
- Use early returns to reduce nesting.
- Use array methods like map, filter, and reduce instead of for/while loops when possible
- Do NOT use `any` type or @ts-ignore directives.
- Do NOT use index files to re-export modules.
- Do NOT add comments unless absolutely necessary for clarity, prefer self-documenting code.

## Testing

This is a proof of concept project, so do not add tests or testing frameworks.

### Typescript

Always check for Typescript errors in the outputs and ensure type safety.
Use strong typing and avoid `any` type.
Use provided types from libraries whenever possible. Do not create duplicate types.
