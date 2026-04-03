FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache chromium firefox ca-certificates git

COPY package.json .
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
