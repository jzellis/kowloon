FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js index.html ./
EXPOSE 2999
CMD ["node", "server.js"]
