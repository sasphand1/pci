FROM node:22-alpine AS build
WORKDIR /stack
# The shared theme is owned by Module 2; it is NOT duplicated in Module 3.
COPY Module_2_Public_Website/packages/ui ./Module_2_Public_Website/packages/ui
COPY Module_3_Admin_Panel/package.json ./Module_3_Admin_Panel/package.json
WORKDIR /stack/Module_3_Admin_Panel
RUN npm install --ignore-scripts --no-audit --no-fund
COPY Module_3_Admin_Panel/ ./
ARG NEXT_PUBLIC_ADAPTER_API_URL=http://localhost:8080
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_ADAPTER_API_URL=$NEXT_PUBLIC_ADAPTER_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build
FROM node:22-alpine AS runtime
WORKDIR /stack/Module_3_Admin_Panel
ENV NODE_ENV=production
COPY --from=build /stack/Module_3_Admin_Panel /stack/Module_3_Admin_Panel
COPY --from=build /stack/Module_2_Public_Website/packages/ui /stack/Module_2_Public_Website/packages/ui
RUN chown -R node:node /stack
USER node
EXPOSE 3001
CMD ["npm","run","start"]
