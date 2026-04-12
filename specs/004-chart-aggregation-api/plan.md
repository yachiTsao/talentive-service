# Implementation Plan: Dashboard Chart Aggregation API

**Branch**: `004-chart-aggregation-api` | **Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-chart-aggregation-api/spec.md`

## Summary

新增 `GET /charts` 端點，讀取現有 jobs.json 資料並透過純函式聚合計算，回傳三張前端圖表所需的統計資料（來源平台比例、前端技術標籤 Top 3、工作地點分佈），附帶最後爬取時間戳。聚合邏輯集中於 `src/utils/chartUtils.ts`（純函式），端點 handler 在 `src/server.ts` 內新增，共用現有的 `lastMeta` 狀態與 jobs.json 讀取邏輯。

## Technical Context

**Language/Version**: TypeScript 5.5 / Node.js 18+  
**Primary Dependencies**: Express 4.19（現有）、Node.js 內建 `fs`（現有）；**無新增執行期依賴**  
**Storage**: `jobs.json`（唯讀，路徑由 `process.env.OUTPUT` 決定，預設 `/app/data/jobs.json`）  
**Testing**: Node.js 內建 test runner（`node --test`）搭配 `ts-node`  
**Target Platform**: Linux server（Docker container）  
**Project Type**: web-service  
**Performance Goals**: ≤200ms p95 回應時間  
**Constraints**: 同步讀檔計算（`fs.readFileSync`）；職缺規模數百至數千筆，無需串流；不引入新環境變數  
**Scale/Scope**: 單一 Node.js 進程，jobs 資料量 <10k 筆

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #   | 原則                                                 | 狀態    | 備註                                                                                             |
| --- | ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| 1   | 新 Provider 實作 `JobProvider` 介面                  | ✅ N/A  | 本功能不新增 Provider                                                                            |
| 2   | 輸出欄位映射至 `BaseJob`，缺值用 `""` 非 null        | ✅ PASS | chartUtils 接受 `BaseJob[]`，不修改資料結構                                                      |
| 3   | API 回傳統一結構 `{ ok: boolean, ... }`              | ✅ PASS | `GET /charts` 成功回傳 `{ ok: true, data: ChartStats }`；失敗回傳 `{ ok: false, error: string }` |
| 4   | 非同步路由使用 `try/catch`，無 raw stack trace       | ✅ PASS | route handler 包覆 try/catch，catch 回傳 HTTP 500 JSON                                           |
| 5   | 全程 `async/await`，無硬編碼機密                     | ✅ PASS | 讀檔為同步操作（`fs.readFileSync`），符合現有慣例；無機密                                        |
| 6   | 新增工具函式須有對應 `*.test.ts`，`node --test` 通過 | ✅ PASS | `src/utils/chartUtils.ts` 搭配 `src/utils/chartUtils.test.ts`                                    |
| 7   | 文件（.md）使用正體中文                              | ✅ PASS | 所有新增 .md 使用正體中文                                                                        |

**結論**：無憲法違規，無需填寫 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/004-chart-aggregation-api/
├── plan.md              ✅ 本文件
├── research.md          ✅ Phase 0 輸出
├── data-model.md        ✅ Phase 1 輸出
├── quickstart.md        ✅ Phase 1 輸出
├── contracts/
│   └── api.md           ✅ Phase 1 輸出
└── tasks.md             ⏳ /speckit.tasks 產出
```

### Source Code (repository root)

```text
src/
├── server.ts              # 新增 GET /charts route handler（~30 行）
├── utils/
│   ├── chartUtils.ts      # 新增：三個純函式 + 型別定義
│   ├── chartUtils.test.ts # 新增：單元測試
│   ├── id.ts              # 現有
│   └── id.test.ts         # 現有
├── favorites/             # 現有，不修改
├── providers/             # 現有，不修改
└── crawler.ts             # 現有，不修改
```

**Structure Decision**: 採用 Option 1（單一專案），新增兩個檔案（`chartUtils.ts` + `chartUtils.test.ts`）並在 `server.ts` 末端附加路由；不引入新的目錄或模組邊界。

## Complexity Tracking

> 無憲法違規，此節不適用。
