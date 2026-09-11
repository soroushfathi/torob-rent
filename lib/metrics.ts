import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "@prometheus-io/client";
import { query, pool } from "./db";
const metricsGlobal = globalThis as unknown as { torobMetrics?: ReturnType<typeof createMetrics> };
function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: "torob_" });
  const request = new Counter({
    name: "torob_http_requests_total",
    help: "API requests by bounded route and status class",
    labelNames: ["route", "method", "status"],
    registers: [registry],
  });
  const latency = new Histogram({
    name: "torob_http_duration_seconds",
    help: "API duration",
    labelNames: ["route"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [registry],
  });
  const database = new Gauge({
    name: "torob_database_up",
    help: "Last database readiness probe",
    registers: [registry],
  });
  const dbLatency = new Gauge({
    name: "torob_database_probe_seconds",
    help: "Last SELECT 1 duration",
    registers: [registry],
  });
  const connections = new Gauge({
    name: "torob_database_pool_connections",
    help: "Node PostgreSQL pool connections",
    labelNames: ["state"],
    registers: [registry],
  });
  const ai = new Gauge({
    name: "torob_ai_calls",
    help: "Durable AI calls over rolling 24 hours",
    labelNames: ["capability", "provider", "outcome"],
    registers: [registry],
  });
  const aiTokens = new Gauge({
    name: "torob_ai_tokens",
    help: "Durable token usage over rolling 24 hours",
    labelNames: ["direction"],
    registers: [registry],
  });
  const aiLatency = new Gauge({
    name: "torob_ai_latency_seconds",
    help: "AI call latency over rolling 24 hours",
    labelNames: ["quantile"],
    registers: [registry],
  });
  const aiCost = new Gauge({
    name: "torob_ai_estimated_usd",
    help: "Estimated USD over rolling 24 hours, only when configured",
    registers: [registry],
  });
  const pricing = new Gauge({
    name: "torob_ai_pricing_configured",
    help: "Whether both AI token prices are configured",
    registers: [registry],
  });
  return {
    registry,
    request,
    latency,
    database,
    dbLatency,
    connections,
    ai,
    aiTokens,
    aiLatency,
    aiCost,
    pricing,
  };
}
export const metrics = metricsGlobal.torobMetrics ?? createMetrics();
metricsGlobal.torobMetrics = metrics;
export async function collectMetrics() {
  const start = performance.now();
  try {
    await query("SELECT 1");
    metrics.database.set(1);
    metrics.dbLatency.set((performance.now() - start) / 1000);
    const rows = await query(
      "SELECT capability,provider,outcome,count(*) n FROM ai_usage WHERE created_at>now()-interval '24 hours' GROUP BY 1,2,3",
    );
    metrics.ai.reset();
    for (const r of rows)
      metrics.ai.set({ capability: r.capability, provider: r.provider, outcome: r.outcome }, Number(r.n));
    const [totals] = await query(
      "SELECT coalesce(sum(input_tokens),0) input,coalesce(sum(output_tokens),0) output,coalesce(sum(estimated_usd),0) cost,coalesce(percentile_cont(.5) WITHIN GROUP(ORDER BY latency_ms),0) p50,coalesce(percentile_cont(.95) WITHIN GROUP(ORDER BY latency_ms),0) p95 FROM ai_usage WHERE created_at>now()-interval '24 hours'",
    );
    metrics.aiTokens.set({ direction: "input" }, Number(totals.input));
    metrics.aiTokens.set({ direction: "output" }, Number(totals.output));
    metrics.aiLatency.set({ quantile: "0.5" }, Number(totals.p50) / 1000);
    metrics.aiLatency.set({ quantile: "0.95" }, Number(totals.p95) / 1000);
    const configured = !!process.env.AI_INPUT_USD_PER_MILLION && !!process.env.AI_OUTPUT_USD_PER_MILLION;
    metrics.pricing.set(configured ? 1 : 0);
    if (configured) metrics.aiCost.set(Number(totals.cost));
  } catch {
    metrics.database.set(0);
  }
  metrics.connections.set({ state: "total" }, pool.totalCount);
  metrics.connections.set({ state: "idle" }, pool.idleCount);
  metrics.connections.set({ state: "waiting" }, pool.waitingCount);
  return metrics.registry.metrics();
}
