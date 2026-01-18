#!/bin/sh
# Start script to run main server + background workers

echo "Starting Kowloon with background workers..."

# Start background workers
node workers/outboxPush.js &
node workers/federationPull.js &
node workers/feedFanOut.js &

# Start main server (foreground)
exec npm start
