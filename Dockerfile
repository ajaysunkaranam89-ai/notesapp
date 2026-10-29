FROM node:20-alpine
RUN apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json ./
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
