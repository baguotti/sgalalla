#!/bin/bash
# Deploy the experimental version to the droplet, next to the release:
#   site          http://138.68.126.112:8080  (/var/www/sgalalla-experimental)
#   game server   port 9209, PM2 process "geckos-experimental" (~/sgalalla-experimental)
# The release (port 80, game server 9208) is left alone.
# Run on your LOCAL machine, from experimental-branch with everything committed.

set -e

DROPLET_IP="138.68.126.112"
BRANCH="experimental-branch"
SITE_PATH="/var/www/sgalalla-experimental"
SERVER_PORT=9209

if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
    echo "Check out $BRANCH first."; exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
    echo "Commit your changes first: the droplet gets what is committed."; exit 1
fi

echo "=== Building $BRANCH ($(git rev-parse --short HEAD)) ==="
npm run build

echo "=== Uploading the site ==="
ssh root@$DROPLET_IP "mkdir -p $SITE_PATH"
rsync -az --delete dist/ root@$DROPLET_IP:$SITE_PATH/

echo "=== Sending $BRANCH to the droplet ==="
# Into the release's repo as a branch; the experimental server runs from its own clone of it
git push "root@$DROPLET_IP:sgalalla" "$BRANCH:$BRANCH"

ssh root@$DROPLET_IP "BRANCH=$BRANCH SITE_PATH=$SITE_PATH SERVER_PORT=$SERVER_PORT bash -s" << 'ENDSSH'
set -e

echo "=== Updating the experimental game server ==="
if [ ! -d ~/sgalalla-experimental ]; then
    git clone --quiet --branch "$BRANCH" ~/sgalalla ~/sgalalla-experimental
fi
cd ~/sgalalla-experimental
git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git reset --quiet --hard "origin/$BRANCH"
cd server-geckos
npm ci --silent
if pm2 describe geckos-experimental > /dev/null 2>&1; then
    PORT=$SERVER_PORT pm2 reload geckos-experimental --update-env
else
    PORT=$SERVER_PORT pm2 start index.ts --name geckos-experimental --interpreter ./node_modules/.bin/tsx
fi
pm2 save
ufw allow $SERVER_PORT/tcp > /dev/null

echo "=== Serving the site on port 8080 ==="
cat > /etc/nginx/sites-available/sgalalla-experimental << EOF
server {
    listen 8080;
    server_name _;

    root $SITE_PATH;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF
ln -sf /etc/nginx/sites-available/sgalalla-experimental /etc/nginx/sites-enabled/

# The old campaign build used to be on 8080
rm -f /etc/nginx/sites-enabled/sgalalla-campaign /etc/nginx/sites-available/sgalalla-campaign
rm -rf /var/www/sgalalla-campaign

chown -R www-data:www-data "$SITE_PATH"
chmod -R 755 "$SITE_PATH"
nginx -t && systemctl reload nginx
ENDSSH

echo ""
echo "=== Experimental version live at http://$DROPLET_IP:8080 ==="
