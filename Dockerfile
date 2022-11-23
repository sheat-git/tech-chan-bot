FROM node:18-slim
LABEL maintainer="dev.sheat@gmail.com"
COPY ./ ./
RUN npm install && npm run compile
CMD [ "npm", "start" ]
