# Stage 1: Build
FROM node:26-alpine AS builder

WORKDIR /app

ARG VITE_APP_VERSION
ENV VITE_APP_VERSION=$VITE_APP_VERSION

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
RUN npm run build && \
    if [ -n "$VITE_APP_VERSION" ]; then \
      sed -i "s/__SW_VERSION__/${VITE_APP_VERSION}/g" dist/sw.js; \
    fi

# Stage 2: Serve with Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
