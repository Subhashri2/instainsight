FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install Python and dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends python3-pip python3-dev build-essential \
    # Install playwright/patchright system dependencies for Chromium
    && apt-get -y install libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libpango-1.0-0 libcairo2 libfontconfig1 libxml2-dev libxslt-dev

# Set the default shell to bash
SHELL ["/bin/bash", "-c"]

# Set working directory
WORKDIR /workspaces/instainsight

# Install PocketBase (Linux version)
RUN apt-get update && apt-get install -y unzip wget \
    && wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.10/pocketbase_0.22.10_linux_amd64.zip \
    && unzip pocketbase_0.22.10_linux_amd64.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/pocketbase \
    && rm pocketbase_0.22.10_linux_amd64.zip
