FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

RUN npm run build \
  && npm prune --omit=dev \
  && mkdir -p /app/backups

ENV NODE_ENV=production
EXPOSE 3001
VOLUME ["/app/backups"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const http=require('node:http'); const port=process.env.PORT||3001; http.get('http://127.0.0.1:'+port+'/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "./server/server.mjs"]
