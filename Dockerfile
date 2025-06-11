## Builder
FROM node:20.12.2-alpine3.18 as builder

WORKDIR /src

COPY .npmrc package.json yarn.lock /src/
RUN yarn install --frozen-lockfile
COPY . /src/
ENV NODE_OPTIONS=--max_old_space_size=4096
RUN yarn build


## App
FROM nginx:1.27.4-alpine

COPY --from=builder /src/dist /app
COPY --from=builder /src/docker-nginx.conf /etc/nginx/conf.d/default.conf

RUN rm -rf /usr/share/nginx/html \
  && ln -s /app /usr/share/nginx/html