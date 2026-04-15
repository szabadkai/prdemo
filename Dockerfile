# Stage 1: Build prdemo
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# Stage 2: Runtime with all dependencies baked in
FROM node:22-slim AS runtime
WORKDIR /app

# System deps for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Copy built app + production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ dist/

# Install Playwright Chromium browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# Install Piper TTS + voice model
RUN curl -sL "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz" \
    -o /tmp/piper.tar.gz \
    && tar -xzf /tmp/piper.tar.gz -C /opt \
    && chmod +x /opt/piper/piper \
    && rm /tmp/piper.tar.gz \
    && mkdir -p /opt/piper-voices \
    && curl -sL "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx" \
       -o /opt/piper-voices/en_US-lessac-medium.onnx \
    && curl -sL "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" \
       -o /opt/piper-voices/en_US-lessac-medium.onnx.json

# Make prdemo available as a global command
RUN npm link

# Set Piper env vars
ENV PIPER_BIN=/opt/piper/piper
ENV PIPER_VOICE=/opt/piper-voices/en_US-lessac-medium.onnx
ENV LD_LIBRARY_PATH=/opt/piper

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
