# --- Stage 1: Build the application ---
# Use an official Node.js image as a base
FROM node:18-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# --- Stage 2: Create the final, smaller production image ---
FROM node:18-alpine

WORKDIR /app

# Copy only the necessary files from the 'builder' stage
COPY --from=builder /app ./

# Cloud Run expects the container to listen on PORT (default 8080)
EXPOSE 8080

# The command to run your application
CMD ["node", "src/server.js"]