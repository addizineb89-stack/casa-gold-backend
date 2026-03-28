FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./server/
COPY shared/ ./shared/
RUN cd server && npm install
COPY server/ ./server/
RUN cd server && npm run build
EXPOSE 3001
CMD ["node", "server/dist/server/src/index.js"]
