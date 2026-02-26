#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"

echo "Starting Sgalalla Local Servers..."

# Clean up any existing processes on these ports
lsof -ti:9208 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start the Node.js backend server in the background
echo "Starting backend server..."
npm run server &

# Start the Vite frontend server in the background
echo "Starting frontend server..."
npm run dev &

echo "Waiting for servers to initialize..."
sleep 3

echo "Opening browser..."
open http://localhost:5173

echo "Servers are running! Close this terminal window to stop them."
# Wait for the background processes so the terminal stays open
wait
