FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY src/db/schema.sql ./dist/db/schema.sql
EXPOSE 3000
CMD ["node", "dist/index.js"]
