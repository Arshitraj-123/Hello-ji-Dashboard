FROM node:20-slim

# Install Chromium and its dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system-installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy server package manifests and install backend dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY server/ ./

# Create uploads directories
RUN mkdir -p uploads/temp-brochures uploads/documents uploads/photos

EXPOSE 5000

CMD ["node", "src/index.js"]
