# syntax=docker/dockerfile:1.7

# -------- Base (deps install) --------
# 使用官方 Playwright 映像，已包含瀏覽器依賴，減少安裝麻煩
FROM mcr.microsoft.com/playwright:v1.55.0-jammy AS base

WORKDIR /app

# 安裝依賴 (只複製 package.json 與 lockfile 以利快取)
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --omit=dev && npm cache clean --force

# -------- Build (ts -> js) --------
FROM base AS build
# 複製 TS 原始碼與 tsconfig 進行編譯
COPY tsconfig.json ./
COPY src ./src
# 安裝 devDependencies 以便 tsc (在 build stage 單獨安裝, 不中轉到最終 runtime)
RUN npm install --no-audit --no-fund
RUN npm run build

# -------- Runtime --------
FROM mcr.microsoft.com/playwright:v1.55.0-jammy AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN mkdir -p /app/data

# 只帶入 production node_modules 與編譯成果
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# 入口腳本 & 權限
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 預設輸出檔案位置 (可被 -v 覆蓋)
VOLUME ["/app/data"]

# 預設參數環境變數 (可於 Zeabur / docker run 覆寫)
ENV KEYWORD="前端工程師" \
    PAGES=1 \
    PROVIDERS="104,yourator,1111" \
    DELAY=700 \
    OUTPUT="/app/data/jobs.json" \
    DEBUG=false

ENTRYPOINT ["docker-entrypoint.sh"]
EXPOSE 3000
CMD ["node","dist/server.js"]
