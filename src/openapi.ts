const BASE_JOB_SCHEMA = {
  type: "object",
  properties: {
    id:       { type: "string", example: "a3f9c021", description: "SHA-256 前 8 碼" },
    title:    { type: "string", example: "前端工程師" },
    company:  { type: "string", example: "範例公司" },
    location: { type: "string", example: "台北市" },
    salary:   { type: "string", example: "60,000–90,000" },
    date:     { type: "string", example: "2026/04/01" },
    url:      { type: "string", example: "https://www.104.com.tw/job/xxxxxxxx" },
    page:     { type: "number", example: 1 },
    source:   { type: "string", example: "104" },
  },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Talentive Service API",
    version: "1.0.0",
    description: "職缺爬蟲服務 API — 支援 104、Yourator、1111 平台並行爬取",
  },
  servers: [{ url: `http://localhost:${process.env.PORT || 3000}` }],
  paths: {
    "/crawl": {
      post: {
        summary: "觸發爬蟲",
        description: "啟動多平台並行爬蟲，回傳本次爬取的所有職缺",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  keyword:   { type: "string",        default: "前端工程師", description: "搜尋關鍵字（1–100 字元）" },
                  pages:     { type: "number",        default: 1,            description: "各 provider 抓取頁數（1–10）" },
                  providers: {
                    oneOf: [
                      { type: "array", items: { type: "string" } },
                      { type: "string", description: "逗號分隔字串" },
                    ],
                    default: ["104", "yourator", "1111"],
                    description: "指定平台清單",
                  },
                  delay:  { type: "number",  default: 700,   description: "頁面間延遲（毫秒，最小 500）" },
                  debug:  { type: "boolean", default: false, description: "啟用 debug HTML 快照" },
                },
              },
              example: { keyword: "資料工程師", pages: 2, providers: ["104", "yourator"] },
            },
          },
        },
        responses: {
          "200": {
            description: "爬取成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok:         { type: "boolean", example: true },
                    durationMs: { type: "number",  example: 8432 },
                    count:      { type: "number",  example: 2 },
                    data:       { type: "array", items: BASE_JOB_SCHEMA },
                  },
                },
              },
            },
          },
          "400": {
            description: "請求參數不合法",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
              },
            },
          },
          "409": {
            description: "爬蟲執行中（請稍後再試）",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, message: { type: "string" } } },
              },
            },
          },
          "500": {
            description: "伺服器錯誤",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/last": {
      get: {
        summary: "取得上次爬取結果",
        description: "讀取磁碟上的 jobs.json；若舊版資料缺少 id 欄位，伺服器即時補齊後回傳（不改寫磁碟）",
        responses: {
          "200": {
            description: "職缺陣列",
            content: {
              "application/json": {
                schema: { type: "array", items: BASE_JOB_SCHEMA },
              },
            },
          },
          "404": {
            description: "尚無爬取結果",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, message: { type: "string" } } },
              },
            },
          },
          "500": {
            description: "伺服器錯誤",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        summary: "健康狀態",
        responses: {
          "200": {
            description: "服務狀態",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok:      { type: "boolean", example: true },
                    running: { type: "boolean", example: false },
                    last:    {
                      type: "object",
                      nullable: true,
                      properties: {
                        at:    { type: "string", example: "2026-04-06T12:00:00.000Z" },
                        count: { type: "number", example: 42 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/favorites/{id}": {
      post: {
        summary: "新增職缺至收藏清單",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", pattern: "^[0-9a-f]{8}$" }, description: "8 碼十六進位職缺 id" }],
        responses: {
          "201": { description: "新增成功", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, data: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, company: { type: "string" }, location: { type: "string" }, salary: { type: "string" }, url: { type: "string" }, source: { type: "string" }, savedAt: { type: "string" } } } } } } } },
          "400": { description: "id 格式不合法", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
          "404": { description: "職缺 id 不存在於爬取結果", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
          "409": { description: "職缺已在收藏清單中", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
          "500": { description: "伺服器錯誤", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
        },
      },
      delete: {
        summary: "從收藏清單移除職缺（冪等）",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", pattern: "^[0-9a-f]{8}$" }, description: "8 碼十六進位職缺 id" }],
        responses: {
          "200": { description: "移除成功（或原本不存在）", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: true } } } } } },
          "400": { description: "id 格式不合法", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
          "500": { description: "伺服器錯誤", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
        },
      },
    },
    "/charts": {
      get: {
        summary: "取得圖表統計資料",
        description: "聚合 jobs.json 回傳三張圖表所需統計：來源平台比例、前端技術標籤 Top 3、工作地點分佈，附帶最後爬取時間戳",
        responses: {
          "200": {
            description: "圖表統計資料",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        platforms: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              platform: { type: "string", example: "104" },
                              count: { type: "number", example: 42 },
                            },
                          },
                        },
                        tags: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              tag: { type: "string", example: "Vue" },
                              count: { type: "number", example: 30 },
                            },
                          },
                        },
                        locations: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              location: { type: "string", example: "台北市" },
                              count: { type: "number", example: 20 },
                            },
                          },
                        },
                        lastCrawledAt: { type: "string", nullable: true, example: "2026-04-12T08:00:00.000Z" },
                      },
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "伺服器錯誤",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/favorites": {
      get: {
        summary: "取得依平台分群的收藏清單",
        responses: {
          "200": { description: "分群收藏清單", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: true }, data: { type: "object", additionalProperties: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, company: { type: "string" }, location: { type: "string" }, salary: { type: "string" }, url: { type: "string" }, source: { type: "string" }, savedAt: { type: "string" } } } } } } } } } },
          "500": { description: "伺服器錯誤", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
        },
      },
    },
  },
};
