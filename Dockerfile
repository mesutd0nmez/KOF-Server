FROM node:alpine

RUN apk update
RUN apk add --no-cache git

RUN apk add --update python3 make g++\
   && rm -rf /var/cache/apk/*

WORKDIR /usr/src/app/kof-server

COPY package.json ./

USER root

RUN yarn global add pm2
RUN yarn install

COPY . .

EXPOSE 8888

CMD ["yarn", "start"]
