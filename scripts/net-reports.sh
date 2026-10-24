#!/bin/bash
# Players' connection reports from the live game server (every 30 s per player in an online match),
# newest last. `bash scripts/net-reports.sh` for the release, `bash scripts/net-reports.sh experimental` for :8081's.
# Kept since the server last started; older ones are in `pm2 logs` on the droplet ([Net] lines).
port=9208
[ "$1" = "experimental" ] && port=9209
curl -s --max-time 10 "http://138.68.126.112:${port}/net"
