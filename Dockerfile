FROM node:20-slim

# Install ffmpeg
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

CMD ["node", "main.js"]
