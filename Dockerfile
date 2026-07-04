# Small, production-lean image.
FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies first so this layer is cached unless package.json changes.
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source.
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

# Run as the non-root user provided by the node image.
USER node

CMD ["node", "src/server.js"]
