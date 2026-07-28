FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080 \
    CLIENTES_INTERNAL_PORT=3000 \
    FUNCIONARIOS_INTERNAL_PORT=3001

WORKDIR /app

COPY package.json package-lock.json ./
COPY clientes/package.json clientes/package-lock.json ./clientes/
COPY funcionarios/package.json funcionarios/package-lock.json ./funcionarios/

RUN npm ci --omit=dev --ignore-scripts \
    && npm ci --omit=dev --ignore-scripts --prefix clientes \
    && npm ci --omit=dev --ignore-scripts --prefix funcionarios

COPY . .

RUN mkdir -p /app/funcionarios/data /app/funcionarios/rede \
    && chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "scripts/healthcheck.js"]

CMD ["node", "gateway.js"]
