# CLAUDE.local.md — talentive-service 開發原則

## TypeScript 要真正嚴格，不靠轉型繞過編譯器

- 不接受 `as SomeType` 作為解決型別錯誤的手段；`as` 是繞過型別系統，不是修正它。
- 正確做法是重新設計型別結構：例如用 `satisfies` 強制約束宣告時的完整性，再另設 `Record<string, T>` 別名供執行期查詢使用，而非在 call site 散落轉型。
- `as any` 絕對禁止；不確定的外部資料用 `unknown` 再 narrow。
- TypeScript 的 strict mode 不是裝飾，每一個型別錯誤都要真正解決。

## 單一真相來源，不容許需要手動同步的重複定義

- 同一份資料（例如合法的 provider 清單）只能有一個地方定義；其他地方必須從它派生，不能各自維護副本。
- 兩個需要手動保持一致的清單就是一個潛在的 bug，不論短期內它們是否一致。
- 利用 TypeScript 的型別系統（如 `Record<ProviderName, ...>`）讓編譯器自動強制一致性，而不是靠人工紀律。

## 可測試性是架構決策，不是事後補的

- 驗證邏輯、業務規則不應埋在 route handler 或 UI 元件裡；要提取成獨立的純函式，才能被單元測試覆蓋。
- 測試是設計階段就要考慮的事：「這段邏輯能被隔離測試嗎？」若不能，表示架構需要調整。
- 新增功能或修正 bug 時，對應的測試案例要一起補上，包含邊界條件（空值、上下界、非法輸入）。

## 關注點分離要徹底執行到目錄結構層級

- 共用的 Express middleware 放 `middleware/`；不同 router 各自定義相同邏輯是不可接受的重複。
- 可重用的工具函式放 `utils/`；不因為「只用一次」就內嵌在呼叫方。
- API 規格（OpenAPI）、驗證邏輯、認證邏輯各自獨立成檔，不混入 server.ts。
- 一個檔案只做一件事；如果需要大量 import 才能理解它，代表職責邊界不清。

## 正確性問題優先於風格問題

- Race condition（TOCTOU）、錯誤的正規式、URL pattern 不一致——這些是 bug，不是 nice-to-have 的改進。
- 防禦性的「也許永遠不會發生」不是拒絕修正的理由；正確的程式碼在邊界條件下也正確。
- 安全問題（path traversal、無輸入驗證）必須立即處理，不進入 backlog。

## 細節容忍度低，死碼必須刪除

- 日文注解混在中文程式碼裡：要修。
- `if (p === 1) break; else break;` 這種死碼：要刪。
- 兩個 URL pattern 前後不一致（`term[]=keyword` vs `term=keyword[]`）：要統一。
- 重複定義的 interface（`interface CliOptions extends CrawlerOptions {}`）、重複的環境變數讀取：要合併。
- 注解不是備份，不執行的東西不應該存在於程式碼中。

## 安全性是基本要求，不是可選項

- 客戶端不應能覆寫伺服器端的檔案輸出路徑（path traversal）。
- 所有外部輸入必須在系統邊界驗證：型別、長度、範圍、白名單。
- 高資源消耗的端點（如觸發爬蟲）需要保護機制，最低限度為 opt-in 的 API key 驗證。
- 驗證邏輯要集中、可測試，不散落在各個 handler 裡。

## 修正而非記錄

- 發現問題就修，不是寫 TODO 或加注解說「這裡有問題」。
- 寧可多花時間把架構做對，也不要留下需要未來人工維護一致性的技術債。
