FROM node:alpine

RUN apk update
RUN apk add --no-cache git

WORKDIR /usr/src/app/kof-server

COPY package.json ./

USER root

RUN yarn global add pm2
RUN yarn install

COPY . .

EXPOSE 8888

CMD ["yarn", "start"]
