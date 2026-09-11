#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/torob-rent/current
compose=(docker compose --env-file /etc/torob-rent/deploy.env)
backup_dir="/var/backups/torob-rent/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
systemctl stop torob-rent-maintenance.timer
trap '"${compose[@]}" start app >/dev/null; systemctl start torob-rent-maintenance.timer' EXIT
"${compose[@]}" stop app
"${compose[@]}" exec -T db pg_dump -U torob_admin -d torob_rent -Fc > "$backup_dir/database.dump"
docker run --rm --network none --read-only --entrypoint sh -v torob-rent_uploads:/data/uploads:ro torob-rent:current -c 'tar czf - -C /data/uploads .' > "$backup_dir/uploads.tar.gz"
docker image inspect torob-rent:current --format '{{.Id}}' > "$backup_dir/image-id.txt"
readlink -f /opt/torob-rent/current > "$backup_dir/release.txt"
sha256sum "$backup_dir/database.dump" "$backup_dir/uploads.tar.gz" > "$backup_dir/SHA256SUMS"
printf 'Backup ready: %s\n' "$backup_dir"
