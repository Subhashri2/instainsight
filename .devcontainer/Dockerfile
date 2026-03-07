FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install system dependencies for Chromium and Scraping
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        build-essential \
        python3-pip \
        python3-dev \
        python3-venv \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libpangocairo-1.0-0 \
        libpango-1.0-0 \
        libcairo2 \
        libfontconfig1 \
        libxml2-dev \
        libxslt-dev \
        libharfbuzz0b \
        libwayland-client0 \
        libwayland-cursor0 \
        libwayland-egl1 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcursor1 \
        libxi6 \
        libxkbcommon-x11-0 \
        libxrender1 \
        libxtst6 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the default shell to bash
SHELL ["/bin/bash", "-c"]

# Install PocketBase (Linux version)
RUN apt-get update && apt-get install -y unzip wget curl \
    && wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.10/pocketbase_0.22.10_linux_amd64.zip \
    && unzip pocketbase_0.22.10_linux_amd64.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/pocketbase \
    && rm pocketbase_0.22.10_linux_amd64.zip

# Create a place for browsers to be cached globally
ENV PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright
RUN mkdir -p /home/node/.cache/ms-playwright && chown -R node:node /home/node/.cache/ms-playwright

# Set working directory
WORKDIR /workspaces/instainsight

# Copy dependency files first for better caching
COPY requirements.txt ./
COPY package.json package-lock.json* ./

# Reset permissions so the node user can install things if needed later
RUN chown -R node:node /workspaces/instainsight

# Switch to node user for installs to follow devcontainer best practices
USER node

# Install dependencies during build
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt \
    && python3 -m playwright install --with-deps chromium \
    && python3 -m patchright install chromium \
    && scrapling install

# Install NPM dependencies
RUN npm install
