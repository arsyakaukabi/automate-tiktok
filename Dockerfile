FROM node:20-slim

# Install ffmpeg + build tools untuk native modules (better-sqlite3, dll)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy hanya file dependency dulu
COPY package*.json ./
COPY tobyg74-tiktok-api-dl-1.3.7.tgz ./


# Install dependencies di DALAM container (Linux)
# npm ci lebih deterministik, kalau kamu punya package-lock.json
RUN npm ci --omit=dev || npm install --omit=dev

# Baru copy source code lainnya (TANPA node_modules)
COPY . .

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Default: jalanin app
CMD ["node", "main.js"]
