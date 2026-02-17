---
name: digitalocean-deploy
description: Production-grade deployment workflow for Node.js (Geckos.io) and Phaser games on DigitalOcean.
license: MIT
metadata:
  version: "1.1.0"
  author: ant-generated
---

# DigitalOcean Deployment for Geckos.io Games

State of the art deployment pipeline including Security Hardening, Log Rotation, and CI/CD.

## 1. Droplet & Security Hardening

**Do NOT just run `apt install`. Hardening is mandatory.**

### Firewall (UFW)
Open ONLY what is necessary.
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw allow 9208/udp # Geckos Game Port
sudo ufw enable
```

### Fail2Ban
Prevent brute-force SSH attacks.
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 2. Process Management (PM2 State of the Art)

**Problem**: Logs fill up the disk.
**Solution**: `pm2-logrotate`.

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**Startup**:
```bash
pm2 start dist/server/index.js --name "game-server" --env production
pm2 save
pm2 startup
```

## 3. Nginx Caching & Compression

Serve Phaser assets efficiently with Gzip/Brotli and long cache headers.

`/etc/nginx/sites-available/game`:
```nginx
server {
    listen 80;
    server_name game.example.com;
    root /var/www/game/dist/client;

    # Enable Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache Control for Standard Assets (1 year)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 4. CI/CD (GitHub Actions)

**Automated Deploy**: Push to `main` -> Deploy.

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to DO
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install & Build
        run: |
          npm ci
          npm run build
      - name: SCP Files
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.DO_HOST }}
          username: root
          key: ${{ secrets.DO_SSH_KEY }}
          source: "dist/"
          target: "/var/www/game"
      - name: Restart Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DO_HOST }}
          username: root
          key: ${{ secrets.DO_SSH_KEY }}
          script: |
            pm2 reload game-server
```

## 5. SSL & WebSockets

If connecting via wss://, ensure proper proxying if not using direct UDP.
Geckos (UDP) works alongside HTTPS without extra config if `iceServers` are set correctly, but signaling (HTTP/WS) must be secure.
