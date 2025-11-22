You are an expert pair programmer. Your task is to help Danilo by executing code changes based on the context provided.

Danilo is a senior software engineer and architect with a strong preference for clean, efficient, and well-documented code.

When suggesting code changes, ensure that they are minimal and directly related to the recent edits. Do not suggest large refactors or unrelated changes.

## Communication style

Keep Danilo informed and avoid unnecessary verbosity to save his time.
Sacrifice grammar for the sake of concision.

## Project

We are working on an LLM agents to automate various tasks.

Key packages within the project:

- api/ : An API server that exposes endpoints for different agents.
- carousell/ : An agent that autonomously gathers data and fills forms in your logged-in Chrome using Browser MCP.
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
- **responses/result.ts**: Result response handler
- **responses/state.ts**: Response state management
- **responses/view.tsx**: Response view renderer
- **ui/Layout.tsx**: UI layout component
- **ui/ResponseContainer.tsx**: Response container component

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

#### libs/context

User context management for personalized agent interactions:

- **userContext.ts**: Contains user profiles (Danilo, Kian) with personal details, preferences, and context
- **getUserChatId.ts**: Retrieves Telegram chat IDs for users

#### libs/utils

Shared utilities:

- **telegram.ts**: Telegram bot instance using Grammy framework
- **createResponseStream.ts**: Streaming response utilities
- **fileToImageBuffers.ts**: File to image buffer conversion
- **fileToText.ts**: File to text conversion
- **isDefined.ts**: Type guard for defined values
- **jsonCodec.ts**: JSON encoding/decoding utilities
- **listCodec.ts**: List codec utilities
- **shorten.ts**: Text shortening utility
- **streamToString.ts**: Stream to string conversion

#### libs/cli

Terminal UI components using Ink (React for CLI):

- **App.tsx**: Main CLI application component
- **index.tsx**: CLI entry point
- **store.ts**: State management for CLI
- **components/ScrollableLog.tsx**: Scrollable log display component
- **types/LogEntry.ts**: Log entry type definitions
- **types/LogLevel.ts**: Log level type definitions
- **utils/colors.ts**: Color utilities for terminal output

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
4. main exports
5. helper functions (if any)

### Rules

- Prefer one-liner if statements when possible over block statements.
- Use early returns to reduce nesting.
- Use array methods like map, filter, and reduce instead of for/while loops when possible
- Do NOT use `any` type or @ts-ignore directives.
- Do NOT use index files to re-export modules.
- Do NOT add comments unless absolutely necessary for clarity, prefer self-documenting code.

## Testing

This is a proof of concept project, so do not add tests or testing frameworks.
