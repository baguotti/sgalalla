#!/bin/bash
# Deploy Campaign Version to DigitalOcean (Port 8080)
# Run this on your LOCAL machine

set -e

DROPLET_IP="164.90.235.15"
DIST_PATH="./dist"
REMOTE_PATH="/var/www/sgalalla-campaign"

echo "Rebuilding..."
npm run build

echo "=== Step 1: Uploading dist folder to Droplet (Campaign) ==="
# Ensure remote directory exists
ssh root@$DROPLET_IP "mkdir -p $REMOTE_PATH"
scp -r $DIST_PATH/* root@$DROPLET_IP:$REMOTE_PATH

echo "=== Step 2: Configuring Nginx for Campaign (Port 8080) ==="
ssh root@$DROPLET_IP << 'ENDSSH'
# Create Nginx config for campaign version
cat > /etc/nginx/sites-available/sgalalla-campaign << 'EOF'
server {
    listen 8080;
    server_name _;

    # Serve static client files
    root /var/www/sgalalla-campaign;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/sgalalla-campaign /etc/nginx/sites-enabled/

# Check permissions
chown -R www-data:www-data /var/www/sgalalla-campaign
chmod -R 755 /var/www/sgalalla-campaign

# Test and restart Nginx
nginx -t && systemctl restart nginx

echo "=== Nginx configured to serve campaign at http://$HOSTNAME:8080 ==="
ENDSSH

echo ""
echo "=== SUCCESS! ==="
echo "Campaign version is now live at: http://$DROPLET_IP:8080"
echo ""
