FROM docker.io/library/node:18-alpine AS base-image
RUN apk update && apk upgrade && rm -rf /var/cache/apk/* && npm install -g npm

# Build svelte app into /src/public/build & server.js
FROM base-image AS svelte-builder
WORKDIR /src
COPY public/static/ /src/public/static/
COPY src/ /src/src
COPY .prettierrc.yaml package.json rollup.config.mjs tsconfig.json package-lock.json server.ts /src/

RUN npm ci \
  && npm run build

# Download runtime node_modules
FROM base-image AS runtime-node-modules
WORKDIR /src
COPY package.json package-lock.json /src/
RUN npm ci --omit=dev

# Final image
FROM base-image AS vizl-app
LABEL Author="Anirban Mukhopadhyay"

# Create a non-root user
ARG USER=node-user
RUN addgroup -S ${USER} && adduser -D -H -S -G ${USER} ${USER}

WORKDIR /src

# Copy built svelte files & compiled server.js
ARG DIST_DIR_ARG="/dist"
ENV DIST_DIR ${DIST_DIR_ARG}
COPY --chown=${USER}:${USER} --from=svelte-builder /src/public/ ${DIST_DIR_ARG}/
COPY --chown=${USER}:${USER} --from=svelte-builder /src/server.js /src/

# Copy node_modules
COPY --chown=${USER}:${USER} --from=runtime-node-modules /src/package.json /src/package-lock.json /src/
COPY --chown=${USER}:${USER} --from=runtime-node-modules /src/node_modules/ /src/node_modules/

USER ${USER}

ENV PORT 8080
ENTRYPOINT ["node", "server.js"]
