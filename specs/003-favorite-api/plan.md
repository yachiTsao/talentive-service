# Implementation Plan: Favorite API

**Branch**: `003-favorite-api` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-favorite-api/spec.md`

## Summary

為 `talentive-service` 新增收藏功能 API：`POST /favorites/:id`（新增）、`DELETE /favorites/:id`（移除）、`GET /favorites`（依平台分群列出），並修改現有 `GET /last` 端點以附加 `is_fav` 欄位。收藏清單持久化為本地 `favorites.json`，使用 Promise Chain Lock 確保寫入一致性，資料模型為新增當下的職缺快照。

## Technical Context

**Language/Version**: TypeScript 5.5 / Node.js 18+  
**Primary Dependencies**: Express 4.19、ts-node 10.9（dev）、Node.js `crypto`、`fs`（內建，無新增依賴）  
**Storage**: 本地 JSON 檔案（`favorites.json`，路徑由 `FAVORITES_OUTPUT` 環境變數設定，預設 `/app/data/favorites.json`）  
**Testing**: Node.js 內建 test runner（`node --test`）搭配 `ts-node`  
**Target Platform**: Linux server（Docker container）  
**Project Type**: web-service  
**Performance Goals**: 所有端點 < 200ms（正常負載，本地 JSON 讀寫）  
**Constraints**: 單用戶無 auth、in-process mutex 確保寫入序列化、`is_fav` 不落地  
**Scale/Scope**: 單 server 實例，收藏清單數量預期百筆以下

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 憲法原則                                       | 適用性 | 狀態 | 說明                                                  |
| ---------------------------------------------- | ------ | ---- | ----------------------------------------------------- |
| Provider 實作 `JobProvider` 介面               | N/A    | ✅   | 本功能無新增爬蟲 Provider                             |
| 輸出欄位映射至 `BaseJob`，缺值用 `""`          | 適用   | ✅   | `FavoriteEntry` 繼承 `BaseJob` 所有欄位，缺值規則沿用 |
| API 回傳統一結構 `{ ok: boolean, ... }`        | 適用   | ✅   | 全部端點遵循，contracts/api.md 已定義                 |
| 非同步路由使用 `try/catch`，無 raw stack trace | 適用   | ✅   | 所有 handler 包覆 try/catch                           |
| 全程 `async/await`，無硬編碼機密               | 適用   | ✅   | 路徑來自環境變數，無硬編碼                            |
| 新增工具函式須有 `*.test.ts` 覆蓋              | 適用   | ✅   | `store.ts` 中的 pure functions 需測試（見 Phase 1）   |
| 文件（.md）使用正體中文                        | 適用   | ✅   | 所有規格文件均為正體中文                              |

**Post-Phase 1 re-check**: 通過。`isValidJobId()` 及 `FavoriteStore` 函式均已規劃測試覆蓋。

## Project Structure

### Documentation (this feature)

```text
specs/003-favorite-api/
├── plan.md              # 本文件
├── research.md          # Phase 0 輸出
├── data-model.md        # Phase 1 輸出
├── quickstart.md        # Phase 1 輸出
├── contracts/
│   └── api.md           # Phase 1 輸出
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 輸出（/speckit.tasks 產生）
```

### Source Code (repository root)

```text
src/
├── server.ts              # 修改：掛載 favoritesRouter、修改 GET /last
├── favorites/
│   ├── store.ts           # 新增：FavoriteStore 純函式模組（含 mutex）
│   ├── store.test.ts      # 新增：store.ts 單元測試
│   └── router.ts          # 新增：Express Router（POST/:id、DELETE/:id、GET /）
└── utils/
    └── id.ts              # 修改：新增 isValidJobId()（可選，或內聯於 router）
```

**Structure Decision**: 採用單專案結構，在 `src/` 下新增 `favorites/` 子目錄封裝收藏邏輯，符合「新增功能以新增檔案擴充」的憲法原則。`server.ts` 只需新增 `app.use` 一行與修改 `GET /last`，最小化既有程式碼的異動範圍。

## Complexity Tracking

> 無憲法違反，本表保留供 PR 審查確認。

| 違反項目                                                                                              | 理由                                                                                                      | 排除的替代方案                                                                                   |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /last` 回傳頂層陣列（非 `{ ok, data }` 包裝），與憲法「`{ ok: boolean, ... }` 統一結構」原則不符 | 本功能前已存在的行為：前端消費方依賴此陣列格式；本功能僅在陣列元素附加 `is_fav`，未新增違反，屬繼承性例外 | 改為 `{ ok: true, data: [...] }` 包裝 → 會造成前端重大破壞性變更，需同步修改前端，不在本功能範疇 |
