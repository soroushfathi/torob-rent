#!/usr/bin/env bash
set -euo pipefail
# The only created/dropped DB is this script's isolated validation database.
backup_dir="${1:?Pass the exact backup directory}"
case "$backup_dir" in /var/backups/torob-rent/*) ;; *) exit 2 ;; esac
test -f "$backup_dir/database.dump"
sha256sum -c "$backup_dir/SHA256SUMS"
docker exec torob-rent-db-1 createdb -U torob_admin torob_restore_validation
trap 'docker exec torob-rent-db-1 dropdb -U torob_admin torob_restore_validation' EXIT
docker exec -i torob-rent-db-1 pg_restore --exit-on-error --no-owner -U torob_admin -d torob_restore_validation < "$backup_dir/database.dump"
docker exec torob-rent-db-1 psql -U torob_admin -d torob_restore_validation -c 'SELECT (SELECT count(*) FROM listings) listings,(SELECT count(*) FROM bookings) bookings,(SELECT count(*) FROM media) media;'
tar -tzf "$backup_dir/uploads.tar.gz" >/dev/null
echo 'Database restore to isolated validation DB and media archive integrity passed.'
