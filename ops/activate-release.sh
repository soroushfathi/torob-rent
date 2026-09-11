#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
release_dir="$PWD"
compose=(docker compose --env-file /etc/torob-rent/deploy.env)
"${compose[@]}" up -d --wait db
"${compose[@]}" run --rm migrate
if ! "${compose[@]}" exec -T db psql -U torob_admin -d torob_rent -tAc "SELECT 1 FROM pg_roles WHERE rolname='torob_app'" | grep -q 1; then
    "${compose[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U torob_admin -d torob_rent < /etc/torob-rent/roles.sql
fi
"${compose[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U torob_admin -d torob_rent < ops/grants.sql
"${compose[@]}" up -d --no-build --wait app
ln -sfn "$release_dir" /opt/torob-rent/current
mkdir -p /var/backups/torob-rent /var/www/torob-rent-acme
chmod 700 /var/backups/torob-rent
if [ -f /etc/nginx/sites-available/torob-rent ]; then
    cp -p /etc/nginx/sites-available/torob-rent "/var/backups/torob-rent/nginx-$(date +%Y%m%dT%H%M%S).conf"
fi
cp ops/nginx.conf /etc/nginx/sites-available/torob-rent
ln -sfn /etc/nginx/sites-available/torob-rent /etc/nginx/sites-enabled/torob-rent
nginx -t
systemctl reload nginx
cp ops/torob-rent-maintenance.service ops/torob-rent-maintenance.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now torob-rent-maintenance.timer
curl --fail --max-time 10 http://127.0.0.1:3417/api/health
