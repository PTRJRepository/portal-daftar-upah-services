FROM node:18-alpine
WORKDIR /app
COPY package.json /app/package.json
COPY vite.config.js /app/vite.config.js
COPY index.html /app/index.html
COPY src /app/src
RUN npm install
RUN npm run build
EXPOSE 5173
CMD ["npm","run","preview"]
