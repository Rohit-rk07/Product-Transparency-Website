FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install Chromium and fonts for Puppeteer
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Install with devDependencies to build TypeScript
RUN npm ci --include=dev
COPY . .
# Build TypeScript to dist
RUN npx tsc -p .
# Remove devDependencies for smaller runtime image
RUN npm prune --omit=dev
# Set production environment for runtime
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
