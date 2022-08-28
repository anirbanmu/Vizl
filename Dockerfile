FROM docker.io/library/node:16-alpine AS base-image
RUN apk update && apk upgrade

# Build svelte app into /src/public/build & server.js
FROM base-image AS svelte-builder
WORKDIR /src
COPY public/static/ /src/public/static/
COPY src/ /src/src
COPY .prettierrc.yaml package.json rollup.config.js tsconfig.json yarn.lock server.ts /src/

RUN yarn install --frozen-lockfile \
  && yarn build

# Download runtime node_modules
FROM base-image AS runtime-node-modules
WORKDIR /src
COPY package.json yarn.lock /src/
RUN yarn install --production=true --frozen-lockfile

# Final image
FROM base-image AS vizl-app
LABEL Author="Anirban Mukhopadhyay"

# Create a non-root user
ARG USER=ruby-user
RUN addgroup -S ${USER} && adduser -D -H -S -G ${USER} ${USER}


WORKDIR /src

# Copy built svelte files & compiled server.js
ARG DIST_DIR_ARG="/dist"
ENV DIST_DIR ${DIST_DIR_ARG}
COPY --chown=${USER}:${USER} --from=svelte-builder /src/public/ ${DIST_DIR_ARG}/
COPY --chown=${USER}:${USER} --from=svelte-builder /src/server.js /src/

# Copy node_modules
COPY --chown=${USER}:${USER} --from=runtime-node-modules /src/package.json /src/yarn.lock /src/
COPY --chown=${USER}:${USER} --from=runtime-node-modules /src/node_modules/ /src/node_modules/

USER ${USER}

ENV PORT 8080
ENTRYPOINT ["node", "server.js"]
