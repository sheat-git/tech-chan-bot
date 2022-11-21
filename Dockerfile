FROM node:18-slim
LABEL maintainer="dev.sheat@gmail.com"
RUN node install && npm run compile && npm start