FROM node:slim

RUN apt-get update
RUN apt-get install git -y

WORKDIR /usr/src/app/kof-server

COPY package.json ./

USER root

RUN yarn global add pm2
RUN yarn install

COPY . .
