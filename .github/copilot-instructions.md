# talentive-service Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-05

## Active Technologies

- Node.js 18+ LTS
- TypeScript 5.x (`strict: true`)
- Express 4.x
- Playwright 1.55.0 (Chromium)
- better-sqlite3 (SQLite driver, synchronous)
- cors (CORS middleware)

## Project Structure

```text
src/
├── server.ts           # Express HTTP server
├── crawler.ts          # CLI entry + runCrawler() export
├── db/
│   ├── migrate.ts      # SQLite migration runner
│   └── migrations/     # SQL migration files
└── providers/          # Job provider implementations
    ├── types.ts
    ├── provider104.ts
    ├── yourator.ts
    └── provider1111.ts
data/                   # SQLite DB + JSON output (volume-mounted in Docker)
```

## Commands

```bash
npm run dev      # Start server with ts-node
npm run build    # Compile TypeScript
npm run start    # Run compiled JS
```

## Code Style

- TypeScript strict mode — no `any` without documented justification
- Structured log prefixes: `[INFO]`, `[WARN]`, `[ERROR]`, `[DEBUG]`
- All migration failures → `[ERROR]` log + `process.exit(1)` (fail-fast)
- CORS origin: `http://localhost:5173` only

## Recent Changes

- **001-api-scaffold-setup**: Added CORS middleware, SQLite migration framework (`src/db/migrate.ts`), `DB_PATH` env var, `favorites` table initial migration, structured startup log.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
