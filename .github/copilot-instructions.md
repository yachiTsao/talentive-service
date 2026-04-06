# talentive-service Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-06

## Active Technologies
- TypeScript 5.5 / Node.js 18+ + Express 4.19、ts-node 10.9（dev）、Node.js `crypto`、`fs`（內建，無新增依賴） (003-favorite-api)
- 本地 JSON 檔案（`favorites.json`，路徑由 `FAVORITES_OUTPUT` 環境變數設定，預設 `/app/data/favorites.json`） (003-favorite-api)

- TypeScript 5.5 / Node.js 18+ + Playwright 1.55（瀏覽器自動化）、Express 4.19（HTTP Server）、ts-node 10.9（開發執行） (002-optimize-flow-add-id)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.5 / Node.js 18+: Follow standard conventions

## Recent Changes
- 003-favorite-api: Added TypeScript 5.5 / Node.js 18+ + Express 4.19、ts-node 10.9（dev）、Node.js `crypto`、`fs`（內建，無新增依賴）

- 002-optimize-flow-add-id: Added TypeScript 5.5 / Node.js 18+ + Playwright 1.55（瀏覽器自動化）、Express 4.19（HTTP Server）、ts-node 10.9（開發執行）

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
