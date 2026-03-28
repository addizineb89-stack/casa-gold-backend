FROM node:22-alpine
WORKDIR /app/server
COPY shared/ /app/shared/
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/server/src/index.js"]
