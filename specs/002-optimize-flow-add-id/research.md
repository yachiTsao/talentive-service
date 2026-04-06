# Research: 優化爬蟲流程並加入 id 欄位

**Branch**: `002-optimize-flow-add-id` | **Date**: 2026-04-05

## 研究議題與結論

---

### 議題 1：`id` 產生 — SHA-256 實作模式

**決策**：使用 Node.js 內建 `crypto` 模組，SHA-256 雜湊取前 8 碼十六進位

```ts
import crypto from "crypto";

function generateId(url: string): string {
  return crypto
    .createHash("sha256")
    .update(url, "utf8")
    .digest("hex")
    .slice(0, 8);
}
```

**理由**：

- 零額外依賴（Node.js 18+ 原生支援）
- SHA-256 分佈均勻，8 碼（32-bit 空間）在 < 10 萬筆資料下碰撞率 < 0.01%
- 完全確定性：相同 URL 永遠回傳相同結果

**替代方案考量**：

- UUID v4（random）→ 不具確定性，每次爬取 id 不同，下游無法追蹤同一職缺
- nanoid → 需額外依賴，且同樣為隨機
- URL Base64 encode → 長度不固定，且可逆（暴露來源 URL 結構）
- MD5 → 分佈稍差於 SHA-256，且有已知碰撞攻擊（非安全關鍵，但無充分理由選 MD5）

---

### 議題 2：多 Provider 並行執行 — `Promise.allSettled` vs `Promise.all`

**決策**：使用 `Promise.allSettled()`

```ts
const results = await Promise.allSettled(
  providerNames.map((name) =>
    runProviderWithTimeout(page, provider, opts, 120_000),
  ),
);

for (const result of results) {
  if (result.status === "fulfilled") {
    all.push(...result.value);
  } else {
    console.warn(`[PROVIDER ERROR] ...`, result.reason);
  }
}
```

**理由**：

- `Promise.all()` 在任一 Promise reject 時立即拋出，導致其他 provider 結果全部遺失 → 不符合 FR-005
- `Promise.allSettled()` 等待所有 Promise 完成，每筆結果包含 `{ status, value | reason }` → 完美匹配「失敗不中斷」需求
- Node.js 18+ 原生支援，零依賴

**替代方案考量**：

- rxjs 的 `forkJoin` / `combineLatest` → 需引入 rxjs，過度複雜，YAGNI
- 手動 try/catch 包裹每個 await → 仍需串行執行，失去並行效益

---

### 議題 3：Per-Provider 逾時包裝

**決策**：使用 `Promise.race` + `setTimeout`，`clearTimeout` 防止計時器洩漏

```ts
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  name: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[${name}] 逾時 (${ms}ms)`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
```

**理由**：

- `clearTimeout` 在 resolve 與 reject 兩條路徑皆執行，確保計時器不洩漏
- 相比 `AbortController`，此模式更簡單且不需要 Playwright Page 支援 AbortSignal
- 逾時後原始 Playwright page 操作仍會繼續直到自然結束或 browser 關閉 → 因 browser 在 `finally` 中關閉，不影響資源釋放

**注意事項**：

- 每個 provider 使用獨立 `Page` 實例（現有架構），逾時只影響等待，不強制殺死 Playwright Page
- Page 的最終清理靠 `browser.close()`（`finally` 區塊），不需額外處理

---

### 議題 4：`GET /last` 即時補齊 id — 不改寫磁碟策略

**決策**：讀取後在記憶體中補齊，直接回傳修改後的 JSON 字串

```ts
// server.ts GET /last 修改後邏輯
const parsed: any[] = JSON.parse(txt);
const needsId = parsed.some((j: any) => !j.id);
if (needsId) {
  const patched = parsed.map((j: any) => ({
    ...j,
    id: j.id || (j.url ? generateId(j.url) : ""),
  }));
  // 發出警告（如有空 url）
  patched
    .filter((j: any) => !j.id)
    .forEach((j: any) =>
      console.warn(`[GET /last] 無法產生 id，缺少 url: ${JSON.stringify(j)}`),
    );
  return res.json(patched);
}
res.setHeader("Content-Type", "application/json; charset=utf-8");
res.send(txt);
```

**理由**：

- 不改寫磁碟符合 FR-009 的 MUST NOT 要求
- 舊版檔案（無 id）在下次爬取後自然更新，無需主動遷移
- `generateId` 函式與 crawler.ts 共用（抽離至 `utils/id.ts` 或直接 re-export），確保補齊結果與重新爬取一致

---

### 議題 5：雜湊碰撞處理 — id-based dedup 策略

**決策**：在現有 URL-based dedup 之後，增加 id-based 碰撞偵測

執行順序：

1. 原有 `dedupeByUrl()`（URL 為 key）— 去除跨 provider 同 URL 重複
2. 新增 `assignIds()`（產生 id，偵測碰撞）

```ts
function assignIds(jobs: BaseJob[]): BaseJob[] {
  const seenIds = new Map<string, string>(); // id → url
  const result: BaseJob[] = [];
  for (const job of jobs) {
    const id = generateId(job.url);
    if (seenIds.has(id)) {
      console.warn(
        `[ID COLLISION] id=${id} url1=${seenIds.get(id)} url2=${job.url} 捨棄後者`,
      );
      continue;
    }
    seenIds.set(id, job.url);
    result.push({ ...job, id });
  }
  return result;
}
```

**理由**：

- 碰撞機率極低（< 0.01%），捨棄後出現者是最簡單且可接受的策略
- `console.warn` 提供可觀察性，運維可在日誌中發現碰撞
- 不增加複雜度（不自動延伸雜湊長度）

---

## 最終技術選擇摘要

| 議題     | 選擇                                  | 新依賴 |
| -------- | ------------------------------------- | ------ |
| id 產生  | `crypto.createHash('sha256')`         | 無     |
| 並行執行 | `Promise.allSettled()`                | 無     |
| 逾時控制 | `Promise.race` + `setTimeout`         | 無     |
| 舊檔補齊 | 記憶體內 map + re-export `generateId` | 無     |
| 碰撞處理 | 捨棄後者 + `console.warn`             | 無     |

**零新依賴**。所有實作均使用 Node.js 18+ 內建 API 或現有 `playwright`/`express`。
