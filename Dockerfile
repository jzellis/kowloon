# Use Node.js LTS
FROM node:20-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Copy and make start script executable
COPY start-all.sh /app/start-all.sh
RUN chmod +x /app/start-all.sh

# Expose port
EXPOSE 3000

# Start the application with workers
CMD ["/app/start-all.sh"]
