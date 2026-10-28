FROM node:24-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/sri-front/browser /usr/share/nginx/html
HEALTHCHECK --interval=15s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
