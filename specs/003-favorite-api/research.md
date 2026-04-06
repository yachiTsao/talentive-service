# Research: Favorite API

**Feature**: 003-favorite-api  
**Phase**: 0 — 規劃前研究  
**Date**: 2026-04-06

---

## 研究問題 1：Node.js 單程序內的寫入互斥鎖

**問題**：如何在 TypeScript / Node.js 中實作 in-process mutex，序列化非同步寫入操作，且不引入外部依賴？

**決策**：採用 Promise Chain Lock（承諾鏈式鎖）模式。

**理由**：

- Node.js 為單執行緒事件循環。`async` 函式在 `await` 點可被其他請求插入，導致 read-modify-write 競爭（TOCTOU）。
- Promise chain 可保證「下一個寫入」等前一個完成後才開始，無需 Worker Thread 或 semaphore 函式庫。
- 與現有 `isRunning` flag 模式一致（模組層級變數），符合憲法要求。

**實作模式**：

```typescript
// src/favorites/store.ts
let writeQueue: Promise<void> = Promise.resolve();

async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  let resolve!: () => void;
  const gate = new Promise<void>((r) => {
    resolve = r;
  });
  const result = writeQueue.then(() => fn());
  writeQueue = result.then(resolve, resolve);
  return result;
}
```

讀取操作（`loadFavorites`、`getFavoriteIds`）不需加鎖，因為 JSON 檔案寫入為原子更新（見研究問題 2）。

**替代方案排除**：

- `async-mutex` npm 套件 → 引入外部依賴，不符合「最簡依賴」原則。
- `ReadWriteLock` → 本專案讀取量小，無需分離讀寫鎖複雜度。

---

## 研究問題 2：JSON 檔案原子寫入防止損毀

**問題**：若寫入途中服務崩潰，如何避免 `favorites.json` 變成部分寫入的損毀檔案？

**決策**：先寫暫存檔（`favorites.json.tmp`），再以 `fs.renameSync` 原子更名取代正式檔案。

**理由**：

- POSIX `rename()` 系統呼叫是原子操作：檔案要麼完整替換，要麼保持不變，不會出現半寫狀態。
- 搭配上述 Promise Lock，可同時防止邏輯競爭與崩潰損毀。
- Docker 環境（Linux）對 rename-in-same-filesystem 原子性有完整保證。

**實作模式**：

```typescript
function writeFavorites(entries: FavoriteEntry[]): void {
  const file = favoritesPath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}
```

**替代方案排除**：

- `fs.writeFileSync` 直接寫入 → 崩潰時有損毀風險，需額外 try/catch 處理。
- `fs.writeFile`（async）→ 需搭配 await，複雜度略高，收益相同。

---

## 研究問題 3：FavoriteStore 模組架構

**問題**：FavoriteStore 應以模組函式、類別、或 Express Router 形式組織？

**決策**：純函式模組（`src/favorites/store.ts`），搭配 Express Router 掛載（`src/favorites/router.ts`）。

**理由**：

- 純函式無 `this` 語境，易於單元測試（直接 import 呼叫）。
- 與現有 `src/utils/id.ts` 的模組函式風格一致。
- Router 抽取後，`server.ts` 只需 `app.use('/favorites', favoritesRouter)` 一行，保持路由集中管理。
- FavoriteStore 函式可被 `GET /last` 的 handler 直接 import，不需透過 HTTP 呼叫。

**檔案分工**：

```
src/favorites/
├── store.ts    # loadFavorites / saveFavorites / addFavorite / removeFavorite / getFavoriteIds
└── router.ts   # Express Router：POST /:id、DELETE /:id、GET /
```

**替代方案排除**：

- Class-based FavoriteService → 過度設計，單用戶場景不需實例管理。
- 全部內嵌 `server.ts` → server.ts 已有 250+ 行，分模組更易維護。

---

## 研究問題 4：`GET /last` 整合 `is_fav` 最佳作法

**問題**：如何在現有 `GET /last` handler 中注入 `is_fav`，且不改變 `jobs.json` 磁碟內容？

**決策**：讀取 `jobs.json` 後，即時載入 `favorites.json` 的 id Set，對每筆 job 物件以 spread 附加 `is_fav` 欄位後回傳。

**理由**：

- Set 查找為 O(1)，即使數百筆職缺也在微秒級完成。
- Spread（`{ ...job, is_fav: ids.has(job.id) }`）不修改原始物件，無副作用。
- 現有路徑已有「即時補齊 id」邏輯，模式一致。

**實作模式**：

```typescript
const favIds = getFavoriteIds(); // Set<string>，讀 favorites.json
const enriched = parsed.map((j: BaseJob) => ({
  ...j,
  is_fav: favIds.has(j.id),
}));
return res.json(enriched);
```

---

## 研究問題 5：`id` 格式驗證策略

**問題**：如何在路由 handler 中驗證路徑參數 `:id` 為合法的 8 碼十六進位字串，符合 FR-006？

**決策**：使用 `/^[0-9a-f]{8}$/` 正規表示式，在 handler 入口統一驗證，失敗時回傳 HTTP 400。

**理由**：

- 與 `generateId()` 輸出格式完全對應（`crypto.sha256.hex.slice(0,8)`）。
- 無需外部驗證函式庫（如 Joi、Zod），符合最小依賴原則。
- 可抽取為 `isValidJobId(id: string): boolean` 工具函式並撰寫單元測試。

---

## 所有 NEEDS CLARIFICATION 解決確認

| 項目          | 狀態 | 解決方案                 |
| ------------- | ---- | ------------------------ |
| Mutex 實作    | ✅   | Promise Chain Lock       |
| 原子寫入      | ✅   | tmp + rename             |
| 模組架構      | ✅   | store.ts + router.ts     |
| is_fav 注入點 | ✅   | GET /last handler spread |
| id 驗證       | ✅   | /^[0-9a-f]{8}$/ regex    |
