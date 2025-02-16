FROM node:18-alpine AS development

ENV NODE_ENV=development
WORKDIR /app

ARG REACT_APP_BACKEND_PORT
ENV REACT_APP_BACKEND_PORT $REACT_APP_BACKEND_PORT

COPY package*.json ./
RUN npm install

COPY . .
CMD ["npm", "start"]
