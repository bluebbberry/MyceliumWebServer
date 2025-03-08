FROM ubuntu:20.04 AS development

ENV NODE_ENV=development
WORKDIR /app

ARG REACT_APP_BACKEND_PORT
ENV REACT_APP_BACKEND_PORT $REACT_APP_BACKEND_PORT

ARG REACT_APP_SOCIAL_URL
ENV REACT_APP_SOCIAL_URL $REACT_APP_SOCIAL_URL

ARG REACT_APP_SEMANTIC_URL
ENV REACT_APP_SEMANTIC_URL $REACT_APP_SEMANTIC_URL

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
