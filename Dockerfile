ARG APP_ENV=dev

FROM kmamiz-web as web
FROM node:lts-alpine as base
WORKDIR /kmamiz
COPY .env .
COPY package.json package-lock.json ./

FROM base as installed
RUN ["npm", "i"]
COPY . .

FROM installed as dev-installed
RUN ["npm", "run", "test"]

FROM installed as prod-installed

FROM ${APP_ENV}-installed as build
RUN ["npm", "i", "-g", "typescript"]
RUN ["tsc"]

FROM base as prod
ENV NODE_ENV=production
RUN ["npm", "i"]
COPY --from=build /kmamiz/dist .
COPY --from=web /kmamiz-web/dist dist
CMD ["node", "index.js"]