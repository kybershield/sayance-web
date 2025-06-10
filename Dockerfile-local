# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Enable corepack for yarn
RUN corepack enable

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application with increased heap size
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN yarn build

# Production stage
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker-nginx.conf /etc/nginx/conf.d/default.conf

# Create config directory
RUN mkdir -p /usr/share/nginx/html/config

# Copy default config
COPY config.json /usr/share/nginx/html/config/config.json

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
