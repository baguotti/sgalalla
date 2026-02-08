#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting DigitalOcean Setup for Geckos.io Game Server..."

# 1. Update System
echo "📦 Updating system packages..."
apt-get update && apt-get upgrade -y

# 2. Install Node.js 22 (LTS) directly from NodeSource
echo "🟢 Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 3. Install PM2 Global
echo "Manager Installing PM2..."
npm install -g pm2

# 4. Configure Firewall (UFW)
echo "🛡️ Configuring Firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 9208/udp
ufw allow 9208/tcp
# WebRTC UDP Port Range
ufw allow 1025:65535/udp
ufw --force enable

# 5. Clone/Update Repo (Idempotent)
echo "📂 Setting up project..."
if [ -d "sgalalla" ]; then
    echo "   Repo exists, pulling latest..."
    cd sgalalla
    git pull
else
    echo "   Cloning repo..."
    git clone https://github.com/baguotti/sgalalla.git
    cd sgalalla
fi

# 6. Install Server Dependencies
echo "📦 Installing server dependencies..."
cd server-geckos
npm ci

# 7. Start/Restart Server with PM2
echo "🚀 Starting Server..."
# Check if process exists
if pm2 list | grep -q "geckos-server"; then
    pm2 reload geckos-server
else
    # Start using tsx directly from node_modules
    pm2 start index.ts --name "geckos-server" --interpreter ./node_modules/.bin/tsx
fi

# 8. Save PM2 list to respawn on reboot
pm2 save
pm2 startup | tail -n 1 | bash || true

echo "✅ Setup Complete!"
echo "   Server is running on port 9208 (UDP/TCP)"
echo "   Monitor logs with: pm2 logs"
