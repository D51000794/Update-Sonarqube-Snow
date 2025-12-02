
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 4000
CMD ["node", "app.js"]
