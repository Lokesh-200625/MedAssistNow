#!/bin/bash

echo "Starting MedAss Infrastructure..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running."
    echo "Please start Docker and try again."
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Docker is running."

# Install node modules if not present
if [ ! -d "node_modules" ]; then
    echo "Installing node modules..."
    npm install
else
    echo "node_modules already installed."
fi

# Start Docker Compose
echo "Starting Docker services..."
docker compose up -d

# Start the app
echo "Starting application..."
npm start

echo "All services started successfully."