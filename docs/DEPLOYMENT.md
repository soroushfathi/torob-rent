# XDo deployment and recovery

The SSH alias `XDo` was resolved from the user's existing SSH config. Ubuntu 24.04, Docker Compose v2, existing Nginx, Prometheus and Grafana were inspected. Unrelated services and their volumes/configuration were preserved. **All base images use `docker.arvancloud.ir`**: Node 22 bookworm-slim and PostgreSQL 18 alpine.

Layout: `/opt/torob-rent/releases/20260911-initial`, symlink `/opt/torob-rent/current`; Compose project `torob-rent`; app `127.0.0.1:3417`; no public database port. Named volumes `torob-rent_postgres` and `torob-rent_uploads`. PostgreSQL 18 mounts `/var/lib/postgresql`. Application uses role `torob_app`, migrations use separate administrator credentials, Grafana uses aggregate-only `torob_reporting`. The existing `foroushyar_app` network connects monitoring privately.

## Repeatable deployment

Run on the server from a new release containing the reviewed source:

```sh
python3 ops/provision-secrets.py
docker compose --env-file /etc/torob-rent/deploy.env build app
bash ops/activate-release.sh
python3 ops/install-monitoring.py
python3 ops/verify-monitoring.py
```

Provisioning creates random values only on first use and never overwrites existing secrets. `/etc/torob-rent` is root-only and environment files are mode 600. Never commit it, print `docker compose config`, publish database dumps or paste credentials into chat. Configure an optional model by securely editing `app.env`, then recreate the app with `up -d --no-build --force-recreate app`.

The initial server could not reach npm reliably. The reproducible offline alternative installed the same lockfile's **Linux x64** dependencies on the development machine:

```sh
node ops/prepare-offline.mjs
tar -czf linux-dependencies.tar.gz -C .local/linux-deps node_modules
# Transfer with scp to the intended release; then on XDo:
mkdir -p .offline
tar xzf linux-dependencies.tar.gz -C .offline
docker build -f Dockerfile.offline -t torob-rent:current .
bash ops/activate-release.sh
```

Do not copy Windows `node_modules` or any local `.env`, `.local`, `.data` or `.next` folder into a source release. The offline dependencies are an ignored build input, not committed source. Release images are built locally on XDo; no application image is pushed to Docker Hub. Give each future verified image an immutable Git revision tag and retain the previous tag.

## Proxy, CDN and TLS

Dedicated vhost `/etc/nginx/sites-available/torob-rent` proxies only `torob-rent.xdo-run.ir` to loopback port 3417 and blocks public `/api/metrics`. The supplied DNS A-record uses Arvan CDN with origin port 80. Public HTTPS is terminated by Arvan with a valid certificate. The CDN-to-origin hop currently uses HTTP, matching the user's DNS configuration. A direct-origin Let's Encrypt attempt timed out reaching its ACME directory; origin HTTPS is not claimed. To encrypt that hop, obtain a certificate, add a dedicated 443 vhost and change **only this subdomain's** CDN origin protocol/port. Do not change the parent domain's shared TLS policy. Keep an ACME renewal monitor if deploying an origin certificate.

**CDN cache correctness:** protected media URLs intentionally have no file extension and responses send `private, no-store, max-age=0`, `CDN-Cache-Control: no-store`, `Vary: Cookie`. Arvan's inherited static-extension caching ignored the previous private-cache policy, so extension-based URLs were retired in migration 003. Public HTTP acceptance tests verify isolation and immediate revocation after pausing a listing. Prefer an explicit bypass rule for `torob-rent.xdo-run.ir/api/*` in CDN configuration as well. Keep `_next/static` public and cacheable. Never cache cookies, authenticated HTML, API JSON or uploaded media.

## Monitoring and health

`GET /api/health` probes the database and reports simulated payments and provider configuration. Compose healthchecks/restart policies bound recovery; app and DB each have a 1 GB memory limit; JSON logs rotate at 3×10 MB. A systemd timer expires pending requests and old session/rate-limit rows every minute.

`ops/install-monitoring.py` backs up existing Prometheus files to `/var/backups/torob-rent/monitoring-*`, appends one scrape job and one rule group **in-place** to preserve file bind mounts, validates using the existing container's `promtool`, then HUP-reloads it. It creates separate Grafana provider/datasource/dashboard files and reloads provisioning with the existing administrator credential in memory. It never changes anonymous access or notification routing.

- Prometheus config: `/opt/foroushyar-new/monitoring/prometheus/prometheus.yml`.
- Private target: `torob-rent-app:3000/api/metrics`, bearer token supplied outside Git, scrape 15 seconds.
- Grafana: existing folder **Torob Rent**, `torob-rent-postgres` reads only five aggregate views and defaults to read-only transactions; max 4 role connections, 8-second query timeout.
- Definitions are under `monitoring/`. Rebuild them with `python3 ops/generate-dashboards.py`.

## Backup and restore

`bash ops/backup.sh` briefly stops **only Torob Rent** writes and its maintenance timer, takes a custom-format PostgreSQL dump and uploaded-media archive, records checksums/image/release, then restarts the app/timer even if the backup fails. Backups are root-only under `/var/backups/torob-rent/<UTC timestamp>`. Copy encrypted backups off-server on your chosen schedule; no automated off-server destination was configured.

Restore into a new empty database or an isolated validation environment first. Validate `SHA256SUMS`, `pg_restore --list`, restored row counts and media archive integrity. An application rollback must use a database schema compatible with its image. Snapshot both current DB and media before any destructive recovery. Never run `docker compose down -v` on the production project.

For full recovery, stop the app/timer, create a fresh target database, `pg_restore --no-owner` as the database administrator, reapply `ops/grants.sql`, extract uploads into a fresh volume with UID/GID 1000 ownership, update the environment/Compose volume references to the restored pair, and restart. Keep the original database and volume until restoration is verified. Existing secrets under `/etc/torob-rent` must be backed up separately through an encrypted secret-management channel.

## Rollback

Record the old image ID and release before deployment. For a code-only backward-compatible change, restore the prior image tag in `/etc/torob-rent/deploy.env`, point `/opt/torob-rent/current` at its release and `docker compose --env-file /etc/torob-rent/deploy.env up -d --no-build --wait app`. Do not reverse SQL migrations blindly. For incompatible schemas, restore the matching DB/media backup into fresh storage as above. Dedicated Nginx vhost backups and Prometheus backups can be restored individually, followed by validation and reload; do not replace unrelated shared configuration.
