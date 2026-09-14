FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.3.4  --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --ignore-scripts

COPY . .

RUN pnpm prisma generate

EXPOSE 8000

CMD ["pnpm", "run", "start:dev"]