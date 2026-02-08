#!/bin/bash
# Deploy Client to DigitalOcean for Self-Hosted Game
# Run this on your LOCAL machine (not the server)

set -e

DROPLET_IP="164.90.235.15"
DIST_PATH="./dist"
REMOTE_PATH="/var/www/sgalalla"

echo "=== Step 1: Uploading dist folder to Droplet ==="
scp -r $DIST_PATH root@$DROPLET_IP:$REMOTE_PATH

echo "=== Step 2: Configuring Nginx on Droplet ==="
ssh root@$DROPLET_IP << 'ENDSSH'
# Stop Caddy if running
systemctl stop caddy 2>/dev/null || true
systemctl disable caddy 2>/dev/null || true

# Re-enable Nginx
systemctl enable nginx

# Create Nginx config for self-hosted game
cat > /etc/nginx/sites-available/sgalalla << 'EOF'
server {
    listen 80;
    server_name _;

    # Serve static client files
    root /var/www/sgalalla;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression for faster loading
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

# Enable site
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/geckos
ln -sf /etc/nginx/sites-available/sgalalla /etc/nginx/sites-enabled/

# Test and restart Nginx
nginx -t && systemctl restart nginx

echo "=== Nginx configured to serve game at http://$HOSTNAME ==="
ENDSSH

echo ""
echo "=== SUCCESS! ==="
echo "Your game is now live at: http://$DROPLET_IP"
echo ""
echo "Make sure the Geckos server is running: ssh root@$DROPLET_IP 'pm2 status'"
