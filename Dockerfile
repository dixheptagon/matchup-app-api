FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.6.11 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 8000

CMD ["pnpm", "run", "start:dev"]