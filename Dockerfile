FROM node:16 As development
WORKDIR /usr/src/app
COPY package*.json ./
COPY *.lock ./
RUN yarn install
COPY . .
RUN yarn run build

CMD ["node", "dist/main"]