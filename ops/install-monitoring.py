"""Run from a release on XDo. Add only Torob Rent monitoring; never print secrets."""
from pathlib import Path
import base64, datetime, json, os, shutil, subprocess, urllib.request
import yaml

root = Path(__file__).resolve().parent.parent
shared = Path('/opt/foroushyar-new/monitoring')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = Path('/var/backups/torob-rent') / ('monitoring-' + stamp)
backup.mkdir(parents=True, mode=0o700)
prom = shared / 'prometheus/prometheus.yml'
alerts = shared / 'prometheus/alerts.yml'
original = {p: p.read_text() for p in (prom, alerts)}
for p in original:
    shutil.copy2(p, backup / p.name)
    os.chmod(backup / p.name, 0o600)

# Append to the existing final YAML list. File writes preserve bind-mount inodes.
config = yaml.safe_load(original[prom])
assert list(config)[-1] == 'scrape_configs', 'Inspect changed Prometheus layout before merging'
if not any(j['job_name'] == 'torob-rent' for j in config['scrape_configs']):
    job = yaml.safe_load((root / 'monitoring/prometheus/scrape.fragment.yml').read_text())
    job['authorization']['credentials'] = Path('/etc/torob-rent/metrics-token').read_text().strip()
    fragment = yaml.safe_dump([job], sort_keys=False)
    prom.write_text(original[prom].rstrip() + '\n' + '\n'.join('  ' + s for s in fragment.splitlines()) + '\n')
rules = yaml.safe_load(original[alerts])
assert list(rules) == ['groups'], 'Inspect changed alert layout before merging'
if not any(g['name'] == 'torob-rent' for g in rules['groups']):
    groups = yaml.safe_load((root / 'monitoring/prometheus/alerts.yml').read_text())['groups']
    fragment = yaml.safe_dump(groups, sort_keys=False)
    alerts.write_text(original[alerts].rstrip() + '\n' + '\n'.join('  ' + s for s in fragment.splitlines()) + '\n')
check = subprocess.run(['docker', 'exec', 'foroushyar-prometheus-1', 'promtool', 'check', 'config', '/etc/prometheus/prometheus.yml'], capture_output=True)
if check.returncode:
    for p, content in original.items():
        p.write_text(content)
    raise RuntimeError('Prometheus validation failed; original files restored. Inspect promtool locally (output may contain configuration).')
subprocess.run(['docker', 'kill', '--signal=HUP', 'foroushyar-prometheus-1'], check=True, stdout=subprocess.DEVNULL)
print('Prometheus config and alert rules validated; reloaded existing server.')

groot = shared / 'grafana'
dest = groot / 'dashboards/torob-rent'
dest.mkdir(exist_ok=True)
for p in (root / 'monitoring/grafana/dashboards').glob('*.json'):
    shutil.copy2(p, dest / p.name)
    os.chmod(dest / p.name, 0o644)
provider = groot / 'provisioning/dashboards/torob-rent.yaml'
shutil.copy2(root / 'monitoring/grafana/provider.yml', provider)
os.chmod(provider, 0o644)
ds = yaml.safe_load((root / 'monitoring/grafana/datasource.example.yml').read_text())
ds['datasources'][0]['secureJsonData']['password'] = Path('/etc/torob-rent/reporting-password').read_text().strip()
target = groot / 'provisioning/datasources/torob-rent.yaml'
target.write_text(yaml.safe_dump(ds, sort_keys=False))
os.chown(target, 472, 0)
os.chmod(target, 0o600)
g = json.loads(subprocess.check_output(['docker', 'inspect', 'foroushyar-grafana-1']))[0]
env = dict(v.split('=', 1) for v in g['Config']['Env'] if '=' in v)
auth = base64.b64encode((env.get('GF_SECURITY_ADMIN_USER', 'admin') + ':' + env['GF_SECURITY_ADMIN_PASSWORD']).encode()).decode()
for resource in ['datasources', 'dashboards']:
    request = urllib.request.Request('http://127.0.0.1:3300/api/admin/provisioning/' + resource + '/reload', data=b'', headers={'Authorization': 'Basic ' + auth, 'Host': 'grafana.foroush-yar.ir', 'X-Forwarded-Proto': 'https'}, method='POST')
    with urllib.request.urlopen(request, timeout=20) as response:
        assert response.status == 200
print('Grafana datasource and three dashboards provisioned in Torob Rent folder; anonymous access remains disabled.')
