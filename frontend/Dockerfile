FROM node:18-alpine AS development

ENV NODE_ENV=development
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
CMD ["npm", "start"]
