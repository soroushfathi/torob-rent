"""Generate deterministic Grafana definitions. No fabricated activity or secrets."""
import json
from pathlib import Path
out=Path('monitoring/grafana/dashboards');out.mkdir(parents=True,exist_ok=True)
prom={'type':'prometheus','uid':'foroushyar-prometheus'}
pg={'type':'grafana-postgresql-datasource','uid':'torob-rent-postgres'}
def dashboard(uid,title,panels,business=False):
    data={'uid':uid,'title':title,'tags':['torob-rent','prototype'],'timezone':'Asia/Tehran','schemaVersion':39,'version':1,'refresh':'30s','time':{'from':'now-7d' if business else 'now-1h','to':'now'},'panels':panels,'editable':False}
    if business:data['templating']={'list':[{'name':'mode','label':'Data cohort','type':'custom','query':'demo,real,test','current':{'text':'demo','value':'demo'},'options':[{'text':x,'value':x,'selected':x=='demo'} for x in ['demo','real','test']],'includeAll':False,'multi':False}]}
    (out/f'{uid}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def panel(title,query,idx,kind='stat',source=prom,unit='short',description='',width=8):
    target={'refId':'A','datasource':source}
    if source==prom:target.update({'expr':query,'legendFormat':'{{route}}{{capability}}{{provider}}{{outcome}}{{direction}}','instant':kind=='stat'})
    else:target.update({'rawSql':query,'format':'time_series' if kind=='timeseries' else 'table','editorMode':'code'})
    return {'id':idx+1,'title':title,'type':kind,'datasource':source,'gridPos':{'h':8,'w':width,'x':(idx%(24//width))*width,'y':(idx//(24//width))*8},'targets':[target],'description':description,'options':{'reduceOptions':{'calcs':['lastNotNull'],'fields':'','values':False},'legend':{'displayMode':'list','placement':'bottom'}},'fieldConfig':{'defaults':{'unit':unit,'noValue':'Unavailable','decimals':2 if unit in ['s','percentunit','currencyUSD'] else 0},'overrides':[]}}
health=[
 ('Application UP','up{job="torob-rent"}','stat','short','Authenticated private scrape; downtime sustained for 2 minutes alerts.'),
 ('Database readiness','torob_database_up{job="torob-rent"}','stat','short','SELECT 1 probe. Zero for 2 minutes alerts.'),
 ('API requests / second','sum(rate(torob_http_requests_total{job="torob-rent",route!~"metrics|health"}[5m]))','timeseries','reqps','Excludes probes and metric scrapes.'),
 ('API server error fraction','sum(rate(torob_http_requests_total{job="torob-rent",status="5xx",route!~"metrics|health"}[5m])) / clamp_min(sum(rate(torob_http_requests_total{job="torob-rent",route!~"metrics|health"}[5m])),0.000001)','timeseries','percentunit','5xx / all business API requests in a 5 minute rate window.'),
 ('API latency p50','histogram_quantile(0.50,sum by(le)(rate(torob_http_duration_seconds_bucket{job="torob-rent",route!~"metrics|health"}[5m])))','timeseries','s','Histogram over business API requests.'),
 ('API latency p95','histogram_quantile(0.95,sum by(le)(rate(torob_http_duration_seconds_bucket{job="torob-rent",route!~"metrics|health"}[5m])))','timeseries','s','Histogram over business API requests.'),
 ('Database probe latency','torob_database_probe_seconds{job="torob-rent"}','timeseries','s','Readiness-query wall clock time, not all SQL query latency.'),
 ('Database pool connections','torob_database_pool_connections{job="torob-rent"}','timeseries','short','Bounded labels: total, idle, waiting.'),
 ('Application process resident memory','torob_process_resident_memory_bytes{job="torob-rent"}','timeseries','bytes','Linux process metric.'),
 ('Process CPU seconds / second','rate(torob_process_cpu_seconds_total{job="torob-rent"}[5m])','timeseries','short','Linux process CPU.'),
 ('AI p50 / p95 latency · last 24h','torob_ai_latency_seconds{job="torob-rent"}','timeseries','s','Durable database aggregates over rolling 24 hours; includes fallback calls.'),
 ('AI failures · last 24h','sum(torob_ai_calls{job="torob-rent",outcome=~"timeout|invalid|error"}) or vector(0)','stat','short','Failed calls recorded durably; no user prompt labels.'),
 ('AI fallback fraction · last 24h','sum(torob_ai_calls{job="torob-rent",provider="fallback"}) / clamp_min(sum(torob_ai_calls{job="torob-rent"}),1)','stat','percentunit','Fallback calls / all attempted capabilities; unconfigured is explicit.'),
 ('AI token usage · last 24h','torob_ai_tokens{job="torob-rent"}','timeseries','short','Provider-reported input and output token counts.'),
 ('Estimated AI cost · only if prices configured','torob_ai_estimated_usd{job="torob-rent"} and on(job,instance) (torob_ai_pricing_configured{job="torob-rent"} == 1)','stat','currencyUSD','An estimate, not a bill. Unavailable until both token prices are configured.')]
dashboard('torob-health','Torob Rent · Application health',[panel(a,b,i,c,prom,d,e) for i,(a,b,c,d,e) in enumerate(health)])
def sql(expr,view='analytics_search_cohorts'):
    return f"SELECT {expr} FROM {view} WHERE mode = '${{mode}}' AND $__timeFilter(time)"
product=[
 ('Search sessions',sql('coalesce(sum(searches),0) AS searches'),'stat','short','One durable server search execution is one search cohort; retries from client navigation can create a new search.'),
 ('Zero-result rate',sql('sum(zero_results)::float / nullif(sum(searches),0) AS rate'),'stat','percentunit','Zero-result searches / all searches initiated in selected interval and mode.'),
 ('Search → booking request',sql('sum(requested)::float / nullif(sum(searches),0) AS rate'),'stat','percentunit','Distinct search cohorts with >=1 attributed booking / all search cohorts. Later booking progression stays attributed to initiating search day.'),
 ('Search → listing view',sql('sum(viewed)::float / nullif(sum(searches),0) AS rate'),'stat','percentunit','Distinct search cohorts with >=1 attributed view / all search cohorts.'),
 ('Search → comparison',sql('sum(compared)::float / nullif(sum(searches),0) AS rate'),'stat','percentunit','Distinct search cohorts with >=1 comparison / all search cohorts.'),
 ('Search → completed rental',sql('sum(completed)::float / nullif(sum(searches),0) AS rate'),'stat','percentunit','Completed attributed search cohorts / all search cohorts; recent cohorts are immature.'),
 ('Durable event counts',sql('kind, sum(events) AS events','analytics_event_daily')+' GROUP BY kind ORDER BY events DESC','table','short','Listing views, comparisons, booking transitions and first owner publication; idempotent event keys.'),
 ('Booking cohort outcomes',sql('sum(requested_count) AS requested,sum(accepted_count) AS ever_accepted,sum(rejected_count) AS rejected,sum(handed_over_count) AS handed_over,sum(completed_count) AS completed','analytics_booking_cohorts'),'table','short','All outcomes attributed to booking request date. Accepted may later cancel; categories are not mutually exclusive.'),
 ('Booking cancellation rate',sql('sum(cancelled_count)::float/nullif(sum(requested_count),0) AS rate','analytics_booking_cohorts'),'stat','percentunit','Cancelled requests / all booking requests created in selected interval; same booking cohort.'),
 ('First published listing activations',sql("coalesce(sum(events) FILTER(WHERE kind='owner_activated'),0) AS owners",'analytics_event_daily'),'stat','short','At most one activation event per workspace/user. Preloaded synthetic catalog is excluded.'),
 ('Median owner response · rolling 7 days',"SELECT median_seconds FROM analytics_owner_response WHERE mode='${mode}' AND \"window\"='7d'",'stat','s','Exact median of first acceptance/rejection response times, responses in past 7 days. Pending/expired/cancelled-without-response excluded. Fixed rolling window.'),
 ('Search cohorts over time',sql('time,sum(searches) AS searches,sum(requested) AS requested,sum(completed) AS completed')+' GROUP BY time ORDER BY time','timeseries','short','Same initiating-search cohorts; follow-up outcomes backfill earlier days.')]
dashboard('torob-product','Torob Rent · Product funnel (cohort-based)',[panel(a,b,i,c,pg,d,e) for i,(a,b,c,d,e) in enumerate(product)],True)
economics=[
 ('SIMULATED · Requested booking value',sql('coalesce(sum(requested_value),0) AS toman','analytics_booking_cohorts'),'stat','suffix: تومان','All requested rental quotes from selected request-date cohort, including rejected/cancelled; deposits excluded.'),
 ('SIMULATED · Accepted booking value',sql('coalesce(sum(accepted_value),0) AS toman','analytics_booking_cohorts'),'stat','suffix: تومان','Ever-accepted rental value from the same request-date cohort. Later cancellations remain in this gross accepted measure.'),
 ('SIMULATED · Completed rental GMV',sql('coalesce(sum(gmv),0) AS toman','analytics_completed_daily'),'stat','suffix: تومان','Completed-date activity. GMV is gross rental value, not revenue; deposits excluded.'),
 ('SIMULATED · Average completed booking',sql('sum(gmv)::float/nullif(sum(rentals),0) AS toman','analytics_completed_daily'),'stat','suffix: تومان','Completed rental GMV / completed rental count in selected completion-date window.'),
 ('ESTIMATE · Platform commission',sql('coalesce(sum(estimated_commission),0) AS toman','analytics_completed_daily'),'stat','suffix: تومان','Snapshot demo fee policy, default 500 basis points. Estimated, not collected revenue.'),
 ('REAL payment collections / refunds · UNAVAILABLE',"SELECT NULL::numeric AS actual_collections, NULL::numeric AS actual_refunds",'table','suffix: تومان','Payment processing disabled. Null means unavailable, never zero collected revenue.'),
 ('SIMULATED · Completed rental value over time',sql('time,sum(gmv) AS simulated_gmv,sum(estimated_commission) AS estimated_commission','analytics_completed_daily')+' GROUP BY time ORDER BY time','timeseries','suffix: تومان','Completed-date ledger aggregates; actual collections do not exist.'),
 ('SIMULATED · Request-date cohort ledger',sql('time,requested_count,requested_value,accepted_count,accepted_value,completed_count,completed_gmv,cancelled_count','analytics_booking_cohorts')+' ORDER BY time','table','short','Business database views are the source of truth; process-local counters are not used.')]
dashboard('torob-economics','Torob Rent · Marketplace economics · SIMULATED',[panel(a,b,i,c,pg,d,e) for i,(a,b,c,d,e) in enumerate(economics)],True)
print('Generated 3 Grafana dashboards.')
