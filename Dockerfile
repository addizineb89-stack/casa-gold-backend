FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/ ./
COPY shared/ ../shared/
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
