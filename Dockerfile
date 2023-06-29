FROM node:slim

RUN apt-get update
RUN apt-get install git -y

WORKDIR /usr/src/app/discord-bot

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

USER root

RUN npm install -g add pm2
RUN npm install

COPY . .

EXPOSE 8888

CMD ["npm", "start"]