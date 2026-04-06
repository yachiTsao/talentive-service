<!--
同步影響報告
- 版本變更：1.0.0 → 1.1.0
- 原則異動：
	- 新增「文件語言一致性」
	- 既有原則內容統一為正體中文表述
- 新增章節：無
- 移除章節：無
- 需更新的模板：
	- ✅ updated .specify/templates/plan-template.md
	- ✅ updated .specify/templates/spec-template.md
	- ✅ updated .specify/templates/tasks-template.md
	- ✅ updated .specify/templates/checklist-template.md
	- ✅ updated .specify/templates/agent-file-template.md
	- ✅ updated .specify/templates/constitution-template.md
- 其他更新：README.md
- 待辦：無
-->
# ai-workshop-backend 開發憲法

## 核心原則

### 核心架構與品質
- 架構 MUST 採用簡化版 Clean Architecture 流程：
	Controller → Service → Repository/DB。
- Controllers MUST 僅負責接收 HttpRequest、驗證 ModelState，
	並回傳 IActionResult。
- Services MUST 處理所有商業邏輯，並回傳 DTO 或領域模型。
- DTOs 必須強制使用於所有 API 的 Request/Response；
	Entities MUST NOT 直接對外暴露。
- 所有 Service 與 Repository MUST 透過介面注入以確保解耦。
- 命名規範不可妥協：
	- 非同步方法必須以 `Async` 結尾（例如：`GetUserAsync`）。
	- 介面命名必須使用 `IService` / `IRepository` 形式。
	- 私有方法必須使用 `_privateFunction` 格式（底線小寫開頭）。
**理由**：確保分層一致、可維護且易於測試。

### API 規範與一致性
- RESTful 必須嚴格遵循 HTTP 動詞（GET, POST, PUT, DELETE, PATCH）。
- 所有端點 MUST 回傳 `ApiResponse<T>`，包含 `Success`、`Message`、`Data`。
- 全域例外處理 MUST 透過 Middleware 捕捉，回傳 JSON 500，
	嚴禁輸出 Raw StackTrace。
- 必須啟用 Swagger（OpenAPI），且 Controller 必須提供 XML 註釋。
**理由**：確保一致合約、可預期錯誤與完整文件。

### 測試與驗證
- 單元測試 MUST 使用 xUnit + Moq。
- 輸入驗證 MUST 使用 FluentValidation，保持 Controller 精簡。
- 針對關鍵 API 路徑 MUST 撰寫整合測試。
**理由**：提升正確性、合約穩定性與缺陷可早期發現。

### 效能與安全性
- 必須 100% 使用 async/await；禁止 `.Result` 與 `.Wait()`。
- 資料庫查詢 MUST 使用 `.AsNoTracking()`，除非該實體需要更新。
- 嚴禁在迴圈內執行 SQL 查詢（避免 N+1）。
- 敏感設定（例如連線字串）MUST 來自 appsettings.json 或 User Secrets，
	嚴禁硬編碼。
**理由**：避免死結、提升效能並保護機密。

### Git 與環境管理
- Commit 訊息 MUST 使用類別前綴（例如：`feat:`、`fix:`、`refactor:`、`docs:`）。
- gitignore MUST 排除建置檔案（bin/obj）、環境設定與機密檔案。
**理由**：維持乾淨歷史並避免機密外洩。

### 文件語言一致性
- 專案內所有 .md 檔案（README、文件、註釋）MUST 使用正體中文。
**理由**：確保文件一致性與團隊溝通效率。

## 適用範圍

本憲法適用於此專案內所有 .NET Web API 程式碼與相關產出。
任何偏離 MUST 於實作計畫中記錄並說明理由。

## 遵循與審查流程

- 每份計畫 MUST 包含「憲法檢查」並對應到上述原則。
- 每個 PR MUST 確認：DTO 使用、ApiResponse 封裝、僅 async/await、
	FluentValidation 驗證、必要測試覆蓋、文件為正體中文。
- 任何例外 MUST 明確記錄並取得批准。

## 治理

- 本憲法優先於其他專案慣例。
- 修訂 MUST 附理由、調整版本號並更新日期。
- 版本規則：移除或重大不相容調整為 MAJOR；新增或擴充為 MINOR；
	文字釐清為 PATCH。
- 所有審查 MUST 檢查遵循性；任何合理違反 MUST 記錄於
	Implementation Plan 的 Complexity Tracking。

**Version**: 1.1.0 | **Ratified**: 2026-02-24 | **Last Amended**: 2026-02-24
