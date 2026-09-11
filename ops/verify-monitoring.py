"""Read aggregate Grafana queries and Prometheus status; output no credentials."""
import base64, json, subprocess, urllib.request, urllib.error
from pathlib import Path
root=Path(__file__).resolve().parent.parent
g=json.loads(subprocess.check_output(['docker','inspect','foroushyar-grafana-1']))[0]
env=dict(v.split('=',1) for v in g['Config']['Env'] if '=' in v)
auth=base64.b64encode((env.get('GF_SECURITY_ADMIN_USER','admin')+':'+env['GF_SECURITY_ADMIN_PASSWORD']).encode()).decode()
def api(path,data=None):
    req=urllib.request.Request('http://127.0.0.1:3300'+path,data=json.dumps(data).encode() if data else None,headers={'Authorization':'Basic '+auth,'Host':'grafana.foroush-yar.ir','X-Forwarded-Proto':'https','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)
    except urllib.error.HTTPError as e:
        detail=json.load(e)
        raise RuntimeError(json.dumps(detail,ensure_ascii=False)) from None
evidence={'dashboards':[],'sqlPanels':[]}
for file in (root/'monitoring/grafana/dashboards').glob('*.json'):
    dashboard=json.loads(file.read_text())
    live=api('/api/dashboards/uid/'+dashboard['uid'])
    evidence['dashboards'].append({'uid':dashboard['uid'],'folder':live['meta'].get('folderTitle'),'panels':len(live['dashboard']['panels'])})
    for panel in dashboard['panels']:
        for target in panel.get('targets',[]):
            if 'rawSql' not in target:continue
            sql=target['rawSql'].replace("${mode}",'demo').replace('$mode','demo')
            result=api('/api/ds/query',{'from':'now-7d','to':'now','queries':[{**target,'datasource':{'uid':'torob-rent-postgres','type':'grafana-postgresql-datasource'},'rawSql':sql,'intervalMs':60000,'maxDataPoints':200}]})
            r=result['results'][target['refId']]
            assert not r.get('error'), panel['title']+': '+str(r.get('error'))
            evidence['sqlPanels'].append({'title':panel['title'],'values':[f.get('data',{}).get('values') for f in r.get('frames',[])]})
with urllib.request.urlopen('http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22torob-rent%22%7D',timeout=10) as r:
    evidence['prometheus']=json.load(r)['data']['result']
assert evidence['prometheus'][0]['value'][1]=='1'
print(json.dumps(evidence,ensure_ascii=False,indent=2))
