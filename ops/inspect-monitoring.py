"""Read only the relevant existing monitoring configuration; never print secrets."""
import json, pathlib, subprocess
import yaml
def inspect(name):
    return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
p=inspect('foroushyar-prometheus-1')
g=inspect('foroushyar-grafana-1')
config=yaml.safe_load(pathlib.Path('/opt/foroushyar-new/monitoring/prometheus/prometheus.yml').read_text())
print(json.dumps({'prometheus':{'global':config.get('global'), 'rule_files':config.get('rule_files'), 'jobs':[{'job_name':j.get('job_name'),'metrics_path':j.get('metrics_path'),'static_configs':j.get('static_configs'),'authorization_configured':bool(j.get('authorization'))} for j in config.get('scrape_configs',[])]}},indent=2))
root=pathlib.Path('/opt/foroushyar-new/monitoring/grafana/provisioning')
for file in root.glob('dashboards/*'):
    print('Dashboard providers:',file.name,yaml.safe_load(file.read_text()))
for file in root.glob('datasources/*'):
    d=yaml.safe_load(file.read_text())
    print('Datasource definitions:',file.name,[{k:s.get(k) for k in ('name','uid','type','url','access','isDefault')} for s in d.get('datasources',[])])
env=dict(x.split('=',1) for x in g['Config']['Env'] if '=' in x)
print('Grafana authentication configuration:',{'anonymous_enabled':env.get('GF_AUTH_ANONYMOUS_ENABLED','default false'),'admin_credential_present':bool(env.get('GF_SECURITY_ADMIN_PASSWORD')),'root_url':env.get('GF_SERVER_ROOT_URL'),'basic_auth_enabled':env.get('GF_AUTH_BASIC_ENABLED','default true')})
