#!/bin/bash
# Setup Direct HTTPS via nip.io for Geckos.io Game Server
# Run this on your DigitalOcean Droplet as root

set -e

DOMAIN="164.90.235.15.nip.io"
EMAIL="admin@example.com"  # Change this to your email for Let's Encrypt notifications

echo "=== Step 1: Creating Nginx configuration ==="
cat > /etc/nginx/sites-available/geckos << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:9208;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

echo "=== Step 2: Enabling site ==="
ln -sf /etc/nginx/sites-available/geckos /etc/nginx/sites-enabled/

echo "=== Step 3: Removing default site (if exists) ==="
rm -f /etc/nginx/sites-enabled/default

echo "=== Step 4: Testing Nginx config ==="
nginx -t

echo "=== Step 5: Restarting Nginx ==="
systemctl restart nginx

echo "=== Step 6: Obtaining SSL certificate ==="
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

echo "=== Step 7: Verifying SSL auto-renewal ==="
certbot renew --dry-run

echo ""
echo "=== SUCCESS! ==="
echo "Your server is now accessible via https://$DOMAIN"
echo ""
echo "Next steps:"
echo "1. Restart geckos server: pm2 restart geckos-server"
echo "2. Update client to connect to https://$DOMAIN"
