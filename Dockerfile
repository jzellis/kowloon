FROM node:22-alpine

WORKDIR /app

# Install deps into the image layer.
# Source code is bind-mounted at runtime via docker-compose volume.
# The named volume at /app/node_modules takes precedence over the bind mount,
# so the host's node_modules is never used inside the container.
COPY package.json package-lock.json* ./
RUN npm install

EXPOSE 3000

CMD ["node", "index.js"]
