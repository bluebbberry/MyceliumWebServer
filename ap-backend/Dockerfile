FROM ubuntu:20.04 AS development

ENV NODE_ENV=development
WORKDIR /app

# Install Node.js and dependencies on Ubuntu 20.04
RUN apt-get update && \
    apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    lsb-release && \
    curl -fsSL https://deb.nodesource.com/setup_current.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean

COPY package*.json ./
RUN npm install

COPY . .
CMD ["npm", "run", "dev"]
