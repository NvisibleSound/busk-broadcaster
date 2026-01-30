FROM node:20-alpine

# Install ffmpeg for audio conversion
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy server code
COPY server.js ./

EXPOSE 8081

CMD ["node", "server.js"]
