FROM node:22-bookworm-slim

WORKDIR /workspace

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

CMD ["npm", "run", "check"]
