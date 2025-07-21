FROM node:20

WORKDIR ./

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=production

CMD ["npm", "start"]
