# Implementation Plan: 優化爬蟲流程並加入 id 欄位

**Branch**: `002-optimize-flow-add-id` | **Date**: 2026-04-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-optimize-flow-add-id/spec.md`

## Summary

在 `BaseJob` 加入確定性 `id` 欄位（SHA-256 前 8 碼十六進位），同時將多 provider 串行執行改為 `Promise.allSettled` 並行執行，每個 provider 設定 120 秒獨立逾時，並在 `GET /last` 加入即時補齊舊版 JSON 缺少 `id` 的邏輯。零新 npm 依賴，全程 `async/await`。

## Technical Context

**Language/Version**: TypeScript 5.5 / Node.js 18+  
**Primary Dependencies**: Playwright 1.55（瀏覽器自動化）、Express 4.19（HTTP Server）、ts-node 10.9（開發執行）  
**Storage**: 文件系統（JSON 輸出至 `/app/data/jobs.json`）  
**Testing**: 目前無測試框架；本功能含新邏輯函式（`generateId`、`assignIds`、`withTimeout`），建議未來以 Node.js 內建 `node:test` 補充單元測試  
**Target Platform**: Linux Docker 容器（Node.js 18+）  
**Project Type**: Web Service + CLI  
**Performance Goals**: 並行後總爬取時間 ≤ 最慢 provider 的 1.5 倍；單一 provider 逾時上限 120 秒  
**Constraints**: 零新 npm 依賴；向後相容 JSON 輸出格式；不改寫現有 Provider 內部邏輯  
**Scale/Scope**: 單次爬取 < 10 萬筆職缺；單一部署實例

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原則                                                    | 符合？ | 說明                                                                                                    |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 核心架構：`server.ts` → `crawler.ts` → `providers/*.ts` | ✅     | `generateId`/`assignIds` 置於 `crawler.ts` 協調層；新增 `src/utils/id.ts` 共用函式；未改動任何 Provider |
| Provider MUST 實作 `JobProvider` 介面                   | ✅     | 本功能不新增 Provider，現有三個 Provider 不受影響                                                       |
| `crawler.ts` 只負責協調                                 | ✅     | 並行化邏輯在 `scrapeOnce` 中，id 注入在協調層；Provider 內部邏輯不變                                    |
| API 回傳 `{ ok, ... }` 結構                             | ✅     | `POST /crawl` 與 `GET /last` 回傳結構不變，僅 `data[].id` 新增                                          |
| 防併發保護（409）                                       | ✅     | `isRunning` flag 不受影響                                                                               |
| 全程 `async/await`                                      | ✅     | `Promise.allSettled` 搭配 `await`；`withTimeout` 無同步阻塞                                             |
| Browser 在 `finally` 中關閉                             | ✅     | 並行化後 `browser.close()` 仍在 `finally` 區塊                                                          |
| `BaseJob` 欄位不省略，缺值用 `""`                       | ✅     | `id` 為新增欄位；舊規則維持（Provider 層不變）                                                          |
| 零新 npm 依賴                                           | ✅     | 全部使用 Node.js built-in `crypto`                                                                      |
| `.md` 使用正體中文                                      | ✅     | 本計畫所有文件皆以正體中文撰寫                                                                          |

**結論：無違反，無需 Complexity Tracking 記錄。**

## Project Structure

### Documentation (this feature)

```text
specs/002-optimize-flow-add-id/
├── plan.md              ✅ 本文件
├── research.md          ✅ Phase 0 產出
├── data-model.md        ✅ Phase 1 產出
├── quickstart.md        ✅ Phase 1 產出
├── contracts/
│   └── api.md           ✅ Phase 1 產出
└── tasks.md             ⏳ Phase 2 產出（由 /speckit.tasks 建立）
```

### Source Code (repository root)

```text
src/
├── utils/
│   └── id.ts            # 新增：generateId(url) 共用函式
├── providers/
│   └── types.ts         # 修改：BaseJob 新增 id 欄位
├── crawler.ts           # 修改：並行化、assignIds、withTimeout
└── server.ts            # 修改：GET /last 即時補齊 id
```

**Structure Decision**: 單一專案結構（Option 1）。`generateId` 抽離為 `src/utils/id.ts` 純函式，供 `crawler.ts` 與 `server.ts` 共用，避免重複邏輯。其餘現有目錄結構不變。

## Complexity Tracking

> 無憲法違反，本區塊無需填寫。
