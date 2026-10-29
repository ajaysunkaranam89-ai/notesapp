# ---- base: shared layer with the package files ----
FROM node:20-alpine AS base
RUN apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json ./

# ---- test: install all deps and run the unit tests (Jenkins: docker build --target test) ----
FROM base AS test
RUN npm ci
COPY . .
RUN npm test

# ---- prod: small runtime image (the default target, so a plain `docker build .` builds this one) ----
FROM base AS prod
# npm/yarn are only needed to install dependencies; removing them keeps their bundled (CVE-prone)
# packages out of the runtime image. The app starts with plain `node`.
RUN npm ci --omit=dev \
 && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* /root/.npm
COPY src ./src
COPY public ./public
ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
USER node
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/live || exit 1
CMD ["node", "src/server.js"]
