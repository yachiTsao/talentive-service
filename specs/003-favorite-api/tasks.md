# Tasks: Favorite API

**Input**: Design documents from `/specs/003-favorite-api/`
**Prerequisites**: plan.md ?…ã€spec.md ?…ã€data-model.md ?…ã€contracts/api.md ??

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: ?¯ä¸¦è¡Œï?ä¸å?æª”æ?ï¼Œç„¡?ªå??ä»»?™ç›¸ä¾ï?
- **[Story]**: ?€å±?User Storyï¼ˆUS1?“US4ï¼?
- ?è¿°?…å«ç²¾ç¢ºæª”æ?è·¯å?

---

## Phase 1: Setupï¼ˆå?æ¡ˆç?æ§‹å?å§‹å?ï¼?

**Purpose**: å»ºç? `src/favorites/` å­ç›®?„ç?éª¨æ¶æª”æ?ï¼Œè?å¾Œç?ä»»å??¯ç¨ç«‹é€²è?

- [X] T001 ??`src/favorites/` å»ºç?ç©ºç™½æª?`store.ts` ??`router.ts`ï¼ˆ`export {};` ä½”ä?ï¼Œç„¡å¯¦é??è¼¯ï¼?

---

## Phase 2: Foundationalï¼ˆé˜»å¡æ€§åŸºç¤å»ºè¨­ï?

**Purpose**: ?‹åˆ¥å®šç¾©?id é©—è?å·¥å…·?FavoriteStore ?¸å??½å???mutex ???€??User Story ?‡ä?è³´æ­¤?æ®µå®Œæ?

**? ï? CRITICAL**: æ­¤é?æ®µæœªå®Œæ??ï?ä»»ä? User Story ?‡ä?å¾—é?å§‹å¯¦ä½?

- [X] T002 ??`src/favorites/store.ts` å®šç¾© TypeScript ?‹åˆ¥ï¼š`FavoriteEntry`ï¼? ??BaseJob æ¬„ä? + `savedAt`ï¼Œå…± 8 æ¬„ï??`GroupedFavorites`ï¼ˆ`Record<string, FavoriteEntry[]>`ï¼‰ä»¥??`favoritesPath()` è®€??`FAVORITES_OUTPUT` ?°å?è®Šæ•¸ï¼ˆé?è¨?`/app/data/favorites.json`ï¼‰ï??Œæ?å®šç¾©?±ç”¨?¯èª¤?‹åˆ¥ `class AppError extends Error { constructor(public statusCode: number, message: string) { super(message); } }`ï¼Œä? store ?½å?ä»?`throw new AppError(404, '...')` ?¹å??‹å‡º?router ä»?`err instanceof AppError ? err.statusCode : 500` ?•æ?
- [X] T003 [P] ??`src/utils/id.test.ts` ?°å? `isValidJobId()` ?„å–®?ƒæ¸¬è©¦ï??ˆæ? 8 ç¢¼å??­é€²ä??é•·åº?7/9 ?’ç??å¤§å¯«å?æ¯æ?çµ•ã€ç©ºå­—ä¸²?’ç?ï¼?
- [X] T004 [P] ??`src/favorites/store.test.ts` ?°å??ºç? store ?½å??„å–®?ƒæ¸¬è©¦ï?`loadFavorites` æª”æ?ä¸å??¨æ??å‚³ `[]`?`saveFavorites` å¯«å…¥å¾Œå¯?è??–ã€`getFavoriteIds` ??`favorites.json` **ä¸å???*?‚å??³ç©º Setï¼?
  > **ç¯„å?èªªæ?**ï¼š`getFavoriteIds` ?„ã€ŒSet ?§å®¹?¯å¦æ­?¢º?ï?å¤šç??¶è??ç§»?¤å?ä¸å«è©?idï¼‰æ­¸ T017 æ¸¬è©¦ï¼›T004 ?ªæ¸¬?Œæ?æ¡ˆä?å­˜åœ¨?å‚³ç©?Set?é€™ä???boundary case
- [X] T005 ??`src/utils/id.ts` å¯¦ä? `isValidJobId(id: string): boolean`ï¼ˆæ­£è¦è¡¨ç¤ºå? `/^[0-9a-f]{8}$/`ï¼‰ï?ç¢ºè? T003 æ¸¬è©¦?šé?
- [X] T006 ??`src/favorites/store.ts` å¯¦ä? `withWriteLock`ï¼ˆPromise Chain Lockï¼‰ã€`loadFavorites`ï¼ˆæ?æ¡ˆä?å­˜åœ¨?å‚³ `[]`ï¼‰ã€`saveFavorites`ï¼ˆtmp + renameSync ?Ÿå?å¯«å…¥ï¼‰ã€`getFavoriteIds`ï¼ˆå???`Set<string>`ï¼‰ï?ç¢ºè? T004 æ¸¬è©¦?šé?

**Checkpoint**: ?ºç?å·²å°±ç·?????User Story ?¯ä?åºé?å§‹å¯¦ä½?

---

## Phase 3: User Story 1 ???°å??·ç¼º?³æ”¶?æ??®ï?Priority: P1ï¼‰ğ??MVP

**Goal**: `POST /favorites/:id` ??é©—è??¼å? ????`jobs.json` ??å¯«å…¥ `favorites.json`ï¼Œå???201/400/404/409

**Independent Test**:

```bash
# ç¢ºè? jobs.json å­˜åœ¨å¾Œï?
curl -s -X POST http://localhost:3000/favorites/<valid-id-from-jobs> | jq .
# ?‰å? HTTP 201 + { ok: true, data: {FavoriteEntry} }
curl -s -X POST http://localhost:3000/favorites/<same-id> | jq .
# ?‰å? HTTP 409
curl -s -X POST http://localhost:3000/favorites/gggggggg | jq .
# ?‰å? HTTP 400ï¼ˆé??å…­?²ä?ï¼?
```

### Tests for User Story 1

> **NOTE: ?ˆåŸ·è¡Œç¢ºèªæ¸¬è©¦å¤±?—ï??é€²è?å¯¦ä?**

- [X] T007 [US1] ??`src/favorites/store.test.ts` ?°å? `addFavorite()` ?®å?æ¸¬è©¦ï¼šæ–°å¢æ??Ÿå???`FavoriteEntry`ï¼ˆå« `savedAt`ï¼‰ã€é?è¤‡æ–°å¢æ???409 error?`jobs.json` ä¸å??¨æ???404 error?id ä¸åœ¨ `jobs.json` ?‹å‡º 404 error

### Implementation for User Story 1

- [X] T008 [US1] ??`src/favorites/store.ts` å¯¦ä? `addFavorite(id: string): Promise<FavoriteEntry>`ï¼šè? `jobs.json`ï¼ˆä?å­˜åœ¨??404ï¼‰â? ??idï¼ˆæ‰¾ä¸åˆ°??404ï¼‰â? ?¥å·²å­˜åœ¨??409 ??`withWriteLock` å¯«å…¥ï¼ˆå« `savedAt: new Date().toISOString()`ï¼‰ï?ç¢ºè? T007 æ¸¬è©¦?šé?
- [X] T009 [US1] ??`src/favorites/router.ts` å»ºç? Express Routerï¼Œå¯¦ä½?`POST /:id` handlerï¼š`isValidJobId` é©—è?ï¼?00ï¼‰â? `addFavorite` ??201/404/409/500ï¼ˆ`try/catch`ï¼Œç„¡ raw stack traceï¼?
- [X] T010 [US1] ??`src/server.ts` import favoritesRouter ä¸¦æ–°å¢?`app.use('/favorites', favoritesRouter)`ï¼ˆç½®?¼ç¾?‰è·¯?±ä?å¾Œï?

**Checkpoint**: æ­¤æ? User Story 1 ?‰å¯?¨ç?é©—æ”¶?”â€”`POST /favorites/:id` å®Œæ•´?Ÿèƒ½?¯æ¸¬è©?

---

## Phase 4: User Story 2 ???–å?ä¾å¹³?°å?ç¾¤ç??¶è?æ¸…å–®ï¼ˆPriority: P2ï¼?

**Goal**: `GET /favorites` ??è®€??`favorites.json`ï¼Œä? `source` ?†ç¾¤å¾Œä? `savedAt` ?å†ª?’å?ï¼Œå???`{ ok: true, data: GroupedFavorites }`

**Independent Test**:

```bash
# ?å??·è? T010 å¾Œå??¥æ•¸ç­†è·¨å¹³å°?·ç¼ºï¼Œå?ï¼?
curl -s http://localhost:3000/favorites | jq '.data | keys'
# ?‰ç???["104", "yourator"] ç­‰å¹³?°éµ
curl -s http://localhost:3000/favorites | jq '.data.["104"] | length'
# ?‰è??°å??¸é?ä¸€??
```

### Tests for User Story 2

- [X] T011 [US2] ??`src/favorites/store.test.ts` ?°å? `groupBySource()` ?®å?æ¸¬è©¦ï¼šè·¨å¹³å°è³‡æ??†ç¾¤æ­?¢º?ç¾¤?§ä? `savedAt` ?å†ª?’å??æ??®ç‚ºç©ºå???`{}`?å–®ä¸€å¹³å°?…å‡º?¾ä??‹éµ

### Implementation for User Story 2

- [X] T012 [US2] ??`src/favorites/store.ts` å¯¦ä? `groupBySource(entries: FavoriteEntry[]): GroupedFavorites`ï¼ˆ`reduce` ?†ç¾¤ + `sort` ?å†ªï¼‰ï?ç¢ºè? T011 æ¸¬è©¦?šé?
- [X] T013 [US2] ??`src/favorites/router.ts` å¯¦ä? `GET /` handlerï¼š`loadFavorites` ??`groupBySource` ??`{ ok: true, data: GroupedFavorites }`ï¼ˆ`try/catch`ï¼?00 on errorï¼?

**Checkpoint**: æ­¤æ? User Story 2 ?‰å¯?¨ç?é©—æ”¶?”â€”`GET /favorites` è¿”å?æ­?¢º?†ç¾¤çµæ?

---

## Phase 5: User Story 3 ??ç§»é™¤?¶è?ä¸­ç??·ç¼ºï¼ˆPriority: P3ï¼?

**Goal**: `DELETE /favorites/:id` ???ªç?ç§»é™¤ï¼Œç„¡è«–æ˜¯?¦å??¨ç??å‚³ 200

**Independent Test**:

```bash
curl -s -X DELETE http://localhost:3000/favorites/<existing-id> | jq .
# ?‰å? HTTP 200 + { ok: true }
curl -s -X DELETE http://localhost:3000/favorites/<existing-id> | jq .
# ?æ¬¡?ªé™¤ä»å? HTTP 200ï¼ˆå†ªç­‰ï?
curl -s -X DELETE http://localhost:3000/favorites/zzzzzzzz | jq .
# ?‰å? HTTP 400ï¼ˆé??å…­?²ä?ï¼?
```

### Tests for User Story 3

- [X] T014 [US3] ??`src/favorites/store.test.ts` ?°å? `removeFavorite()` ?®å?æ¸¬è©¦ï¼šå??¨ç? id ç§»é™¤å¾Œä??å‡º?¾æ–¼ `loadFavorites`?ä?å­˜åœ¨??id ?¼å«ä¸æ??¯ï??ªç?ï¼‰ã€ç§»?¤å??¶ä??…ç›®ä¸å?å½±éŸ¿

### Implementation for User Story 3

- [X] T015 [US3] ??`src/favorites/store.ts` å¯¦ä? `removeFavorite(id: string): Promise<void>`ï¼š`withWriteLock` ?…è? ??filter ?‰æ?å®?id ??`saveFavorites`ï¼ˆid ä¸å??¨æ??ä?ä»å??ï?ä¸æ??¯ï?ï¼Œç¢ºèª?T014 æ¸¬è©¦?šé?
- [X] T016 [US3] ??`src/favorites/router.ts` å¯¦ä? `DELETE /:id` handlerï¼š`isValidJobId` é©—è?ï¼?00ï¼‰â? `removeFavorite` ??200ï¼ˆ`try/catch`ï¼?00 on errorï¼?

**Checkpoint**: æ­¤æ? User Story 3 ?‰å¯?¨ç?é©—æ”¶?”â€”`DELETE /favorites/:id` ?ªç?è¡Œç‚º?¯æ¸¬è©?

---

## Phase 6: User Story 4 ???·ç¼º?—è¡¨?„å¸¶?¶è??€?‹æ?è¨˜ï?Priority: P2ï¼?

**Goal**: ä¿®æ”¹?¾æ? `GET /last`ï¼Œç‚ºæ¯ç? `BaseJob` ?„å? `is_fav: boolean`ï¼ˆä?å¯«å? `jobs.json`ï¼?

**Independent Test**:

```bash
# ç¢ºè??å€?id å·²æ”¶?å?ï¼?
curl -s http://localhost:3000/last | jq '[.[] | {id, is_fav}]'
# å·²æ”¶?è€?is_fav=trueï¼Œå…¶é¤?false
# ç§»é™¤?¶è?å¾Œå??¼å«ï¼?
curl -s http://localhost:3000/last | jq '[.[] | select(.id=="<id>") | .is_fav]'
# ?‰ç‚º [false]
```

### Tests for User Story 4

- [X] T017 [US4] ??`src/favorites/store.test.ts` ?°å? `getFavoriteIds()` ?²é?æ¸¬è©¦ï¼šå?ç­†æ”¶?å? Set ?…å«?€??id?ç§»?¤å? Set ä¸å«è©?idï¼ˆ`favorites.json` ä¸å??¨åŸºç¤æ?ä¾‹å·²??T004 è¦†è?ï¼‰ï??¦åœ¨ `src/server.test.ts`ï¼ˆæ? `src/favorites/router.test.ts`ï¼‰æ–°å¢?`GET /last` handler å±¤æ¸¬è©¦ï???å·²æ”¶?ç? id ?¨å??³é™£?—ä¸­ `is_fav` ??`true`?æœª?¶è???`false`ï¼›â‘¡ `favorites.json` ä¸å??¨æ??€?‰è·ç¼?`is_fav` ?‡ç‚º `false`ï¼›â‘¢ `jobs.json` ä¸å??¨æ??å‚³ HTTP 404ï¼ˆé?è­‰æ—¢?‰å?è¡›è¢«ä¿ç?ï¼?

### Implementation for User Story 4

- [X] T018 [US4] ä¿®æ”¹ `src/server.ts` ??`GET /last` handlerï¼šåœ¨?å‚³?å‘¼??`getFavoriteIds()` ?–å? `Set<string>`ï¼Œå?è§??å¾Œç????ä»?`map(j => ({ ...j, is_fav: favIds.has(j.id) }))` å»ºæ??°é™£?—å??å‚³ï¼ˆä?ä¿®æ”¹ `jobs.json`ï¼›`favorites.json` ä¸å??¨æ? Set ?ºç©ºï¼Œ`is_fav` ?¨ç‚º `false`ï¼?
  > **? ï? ä¿ç??¢æ??è¼¯**ï¼š`jobs.json` **ä¸å???*??MUST ä»å???HTTP 404ï¼Œä?å¾—ç§»?¤ç¾?‰ç? 404 å®ˆè?ï¼›`is_fav` ? å??è¼¯?ªå??¨ã€Œå·²?å?è®€??jobs.json?ç?æ­?¸¸è·¯å?ä¸?

**Checkpoint**: æ­¤æ? User Story 4 ?‰å¯?¨ç?é©—æ”¶?”â€”`GET /last` æ¯ç??·ç¼º?«æ­£ç¢?`is_fav` ??

---

## Final Phase: Polish & æ©«å??œæ³¨é»?

**Purpose**: OpenAPI ?‡ä»¶è£œå??æ¸¬è©¦å…¨å¥—é?è­?

- [X] T019 [P] ??`src/server.ts` ??`openApiSpec.paths` ?©ä»¶ä¸­æ–°å¢?`/favorites`ï¼ˆPOST/:id?DELETE/:id?GETï¼‰ä??‹ç«¯é»å?ç¾©ï??…å«?€?‰å??‰ç??‹ç¢¼??schemaï¼ˆå???`contracts/api.md`ï¼?
- [X] T020 ?·è? `npm test`ï¼Œç¢ºèª?`node --test` ?šé??€?‰æ–°å¢æ¸¬è©¦ï?store.test.ts ??T004/T007/T011/T014/T017?id.test.ts ??T003/T005ï¼?

---

## Dependenciesï¼ˆç›¸ä¾é?ä¿‚ï?

```
Phase 2 (T002?“T006)
   ?”â???Phase 3 US1 (T007?“T010)
          ?”â???Phase 4 US2 (T011?“T013)
          ?”â???Phase 5 US3 (T014?“T016)
          ?”â???Phase 6 US4 (T017?“T018) ???…é? T006 (getFavoriteIds)ï¼Œå¯??US1 T010 å®Œæ?å¾Œç??³é€²è?
                ?”â???Final Phase (T019, T020)
```

Phase 4ï¼ˆUS2ï¼‰è? Phase 5ï¼ˆUS3ï¼‰ç?**?…ä?å±¤ç?**?¯ä¸¦è¡Œï?ä¸å? User Storyï¼‰ï?ä½†å??±äº« `store.ts`?`router.ts`ï¼Œä»»?™å±¤ç´šé?åºå??–åŸ·è¡Œã€?

Phase 6ï¼ˆUS4ï¼‰å¯??Phase 3 å®Œæ?å¾Œç??³è? Phase 4/5 **ä¸¦è??²è?**ï¼ˆUS4 ä¿®æ”¹ `server.ts`ï¼Œè? US2/US3 ä¿®æ”¹ `router.ts`/`store.ts` ?¡è?çªï???

---

## Parallel Execution Examples

### Phase 2 ?§éƒ¨ä¸¦è?

```
T002 (store.ts ?‹åˆ¥å®šç¾©)
T003 [P] (id.test.ts æ¸¬è©¦)   ???¯è? T004 ä¸¦è?
T004 [P] (store.test.ts ?ºç?æ¸¬è©¦)
T005 (id.ts å¯¦ä?ï¼Œå? T003 å¯«å?)
T006 (store.ts å¯¦ä?ï¼Œå? T004 å¯«å? + T002 å®Œæ?)
```

### Phase 4 + Phase 6 ä¸¦è?

```
?Œæ??²è?ï¼?
  Thread A: T011 ??T012 ??T013  (US2, store.ts + router.ts)
  Thread B: T017 ??T018          (US4, store.test.ts + server.ts)
```

---

## Implementation Strategy

**MVP ç¯„ç?ï¼ˆå»ºè­°å„ª?ˆäº¤ä»˜ï?**ï¼šPhase 1 + Phase 2 + Phase 3ï¼ˆUS1ï¼?

å®Œæ? MVP å¾Œï?

- Phase 4ï¼ˆUS2 ?—è¡¨ï¼‰å¯ç«‹å³äº¤ä??ç«¯ä½¿ç”¨
- Phase 5ï¼ˆUS3 ç§»é™¤ï¼‰è? Phase 6ï¼ˆUS4 is_favï¼‰ç‚ºå®Œæ•´?Ÿèƒ½?€?€
- ?¨å?æ¸¬è©¦?šé?å¾Œé€²å…¥ Final Phase è£œå? OpenAPI ?‡ä»¶

**ç¸½ä»»?™æ•¸**ï¼?0 ?? 
**??Story ä»»å???*ï¼?

- US1ï¼? ?…ï?T007?“T010ï¼?
- US2ï¼? ?…ï?T011?“T013ï¼?
- US3ï¼? ?…ï?T014?“T016ï¼?
- US4ï¼? ?…ï?T017?“T018ï¼?
- ?ºç?/å»ºè¨­ï¼? ?…ï?T001?“T006?T019?“T020ï¼?
