// Local-only synthetic real-account tests; credentials are generated in memory.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
const base = "http://localhost:14567";
const password = randomBytes(24).toString("hex");
async function call(cookie, path, body, method = "POST", expected = 200) {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      Origin: base,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(r.status, expected, `${method} ${path}`);
  return {
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie,
    header: r.headers.get("set-cookie"),
  };
}
const email = `qa-${randomUUID()}@example.invalid`;
let a = await call("", "auth", {
  action: "register",
  email,
  password,
  name: "Local QA account",
});
assert.equal(a.data.user.mode, "real");
assert.match(a.header, /HttpOnly/i);
assert.match(a.header, /SameSite=lax/i);
await call(
  a.cookie,
  "session",
  { action: "switch", role: "owner" },
  "POST",
  403,
);
await call(
  "",
  "auth",
  { action: "login", email, password: password + "wrong" },
  "POST",
  401,
);
const logged = await call("", "auth", { action: "login", email, password });
assert.equal(logged.data.user.id, a.data.user.id);
await call(logged.cookie, "session", { action: "logout" });
await call(logged.cookie, "listings", undefined, "GET", 401);
const start = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  end = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
const listing = {
  title: "Local QA private listing",
  model: "MacBook Pro",
  chip: "M2",
  ram: 16,
  storage: 512,
  description: "Synthetic local authorization test",
  condition: "good",
  accessories: ["charger"],
  neighborhood: "ونک",
  dailyPrice: 800000,
  deposit: 30000000,
  minDays: 1,
  guarantee: "No payments collected",
  availableFrom: start,
  availableTo: end,
  blocked: [],
  photos: [],
  status: "draft",
  reviewed: true,
};
const created = await call(a.cookie, "listings", listing);
const b = await call("", "auth", {
  action: "register",
  email: `qa-${randomUUID()}@example.invalid`,
  password,
  name: "Local QA second account",
});
await call(b.cookie, "listings/" + created.data.id, undefined, "GET", 404);
await call(b.cookie, "listings/" + created.data.id, listing, "PUT", 403);
console.log(
  "Local real-account auth passed: registration, login, wrong password, cookie policy, logout revocation, no demo-role switching and own-only private listing access.",
);
