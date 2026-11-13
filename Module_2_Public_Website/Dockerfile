FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/ui/package.json ./packages/ui/package.json
RUN npm install --ignore-scripts --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_ADAPTER_API_URL=http://localhost:8080
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_ADAPTER_API_URL=$NEXT_PUBLIC_ADAPTER_API_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN chown -R node:node /app
EXPOSE 3000
USER node
CMD ["node","server.js"]
