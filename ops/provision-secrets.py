"""Create only Torob Rent secret files. Existing files are never replaced."""
from pathlib import Path
import os,secrets
root=Path('/etc/torob-rent')
root.mkdir(mode=0o700,exist_ok=True)
def write(name,content):
    target=root/name
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:f.write(content)
if not (root/'database.env').exists():
    admin=secrets.token_hex(32);app=secrets.token_hex(32);report=secrets.token_hex(32);metric=secrets.token_hex(32)
    write('database.env',f'POSTGRES_USER=torob_admin\nPOSTGRES_PASSWORD={admin}\nPOSTGRES_DB=torob_rent\nPOSTGRES_INITDB_ARGS=--encoding=UTF8\n')
    write('migrate.env',f'DATABASE_URL=postgresql://torob_admin:{admin}@db:5432/torob_rent\n')
    write('app.env',f'DATABASE_URL=postgresql://torob_app:{app}@db:5432/torob_rent\nAPP_ORIGIN=https://torob-rent.xdo-run.ir\nUPLOAD_DIR=/data/uploads\nMETRICS_TOKEN={metric}\nAI_API_KEY=\nAI_MODEL=\nAI_BASE_URL=https://api.openai.com/v1\nAI_TIMEOUT_MS=10000\nDEMO_FEE_BPS=500\nALLOW_DEMO=true\nPAYMENTS_ENABLED=false\n')
    write('reporting-password',report)
    write('metrics-token',metric)
    write('roles.sql',f"CREATE ROLE torob_app LOGIN PASSWORD '{app}';\nCREATE ROLE torob_reporting LOGIN PASSWORD '{report}';\n")
if not (root/'deploy.env').exists():
    write('deploy.env','NODE_IMAGE=docker.arvancloud.ir/node:22-bookworm-slim\nPOSTGRES_IMAGE=docker.arvancloud.ir/postgres:18-alpine\nMONITORING_NETWORK=foroushyar_app\nRELEASE_TAG=current\n')
print('Torob Rent environment files ready; existing secrets preserved.')
