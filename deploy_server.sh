#!/bin/bash
# Deploy Server to DigitalOcean
# Run this on your LOCAL machine

set -e

DROPLET_IP="138.68.126.112"

echo "=== Updating Server Code on Droplet ==="
ssh root@$DROPLET_IP << 'ENDSSH'
set -e

# Navigate to project directory (assumed to be in home dir)
cd sgalalla

# Pull latest changes
echo "⬇️ Pulling latest changes from git..."
git stash
git pull


# Install dependencies if package.json changed
echo "📦 Installing server dependencies..."
cd server-geckos
npm ci

# Restart PM2 process
echo "🔄 Restarting Game Server..."
if pm2 list | grep -q "geckos-server"; then
    pm2 reload geckos-server
else
    echo "⚠️ Server process not found, starting..."
    pm2 start index.ts --name "geckos-server" --interpreter ./node_modules/.bin/tsx
fi

echo "✅ Server Update Complete!"
ENDSSH
