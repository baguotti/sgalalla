#!/bin/bash
# Deploy Server to DigitalOcean
# Run this on your LOCAL machine
#
# The GitHub repository is private, so the droplet can't pull from it: the
# current branch goes from this machine straight to the droplet's copy of the
# repo over SSH.

set -e

DROPLET_IP="138.68.126.112"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "=== Sending branch $BRANCH to the Droplet ==="
# Let a push update the branch the droplet has checked out
ssh root@$DROPLET_IP "git -C sgalalla config receive.denyCurrentBranch updateInstead"
git push "root@$DROPLET_IP:sgalalla" "$BRANCH:$BRANCH"

echo "=== Updating Server Code on Droplet ==="
ssh root@$DROPLET_IP "BRANCH=$BRANCH bash -s" << 'ENDSSH'
set -e

cd sgalalla
git checkout --quiet "$BRANCH"

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
pm2 save

echo "✅ Server Update Complete!"
ENDSSH
