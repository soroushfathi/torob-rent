// Isolated demo HTTP acceptance checks. Never log cookie values.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://localhost:14567";
const origin = process.env.TEST_ORIGIN || base;
let checks = 0;
function session() {
  return { cookie: "" };
}
async function call(
  s,
  path,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
  custom = {},
) {
  const r = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(s.cookie ? { Cookie: s.cookie } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...custom,
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: expected ${expected}, got ${r.status}`,
  );
  checks++;
  const cookie = r.headers.get("set-cookie");
  if (cookie) s.cookie = cookie.split(";")[0];
  return r.headers.get("content-type")?.includes("application/json")
    ? r.json()
    : Buffer.from(await r.arrayBuffer());
}
const first = session(),
  other = session();
await call(first, "listings", undefined, "GET", 401);
await call(first, "session", { action: "demo" }, "POST", 403, {
  Origin: "https://untrusted.invalid",
});
await call(first, "session", { action: "demo" });
await call(other, "session", { action: "demo" });
await call(first, "session", { action: "switch", role: "owner" });
const { listings } = await call(first, "listings");
await call(other, `listings/${listings[0].id}`, undefined, "GET", 404);
const form = new FormData();
form.set(
  "file",
  new Blob([await readFile("public/images/macbook-pro.jpg")], {
    type: "image/jpeg",
  }),
  "sample.jpg",
);
const { url } = await call(first, "media", form);
const photo = await call(first, url.replace("/api/", ""));
assert.equal(photo.subarray(8, 12).toString(), "WEBP");
checks++;
await call(other, url.replace("/api/", ""), undefined, "GET", 404);
const invalid = new FormData();
invalid.set(
  "file",
  new Blob(["not an image"], { type: "image/png" }),
  "bad.png",
);
await call(first, "media", invalid, "POST", 400);
const oversized = new FormData();
oversized.set(
  "file",
  new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/jpeg" }),
  "large.jpg",
);
await call(first, "media", oversized, "POST", 400);
const date = new Date();
date.setUTCDate(date.getUTCDate() + 1);
const start = date.toISOString().slice(0, 10);
date.setUTCDate(date.getUTCDate() + 3);
const end = date.toISOString().slice(0, 10);
const req = {
  startDate: start,
  endDate: end,
  budget: 1,
  maxDeposit: 1,
  minRam: null,
  neighborhood: "",
  chip: "",
  software: "unknown",
  workload: "unknown",
};
const noMatch = await call(first, "search", req);
assert.equal(noMatch.listings.length, 0);
checks++;
const example = listings.find((l) => l.status === "published");
const draft = {
  ...example,
  title: "HTTP upload persistence demo",
  photos: [url],
  status: "published",
  reviewed: true,
};
const saved = await call(first, "listings", draft);
await call(other, `listings/${saved.id}`, draft, "PUT", 403);
await call(first, "session", { action: "switch", role: "renter" });
await call(first, url.replace("/api/", "")); // published media is visible to its renter
await call(first, "session", { action: "switch", role: "owner" });
await call(
  first,
  `listings/${saved.id}`,
  { ...draft, status: "paused" },
  "PUT",
);
await call(first, "session", { action: "switch", role: "renter" });
await call(first, url.replace("/api/", ""), undefined, "GET", 404); // unlisted photo remains private
await call(
  first,
  "metrics",
  undefined,
  "GET",
  base.includes("localhost") ? 401 : 404,
);
// Save only local session state needed to verify a restart; this file is ignored by Git.
await writeFile(
  ".local/http-persistence.json",
  JSON.stringify({
    base,
    origin,
    cookie: first.cookie,
    listingId: saved.id,
    url,
    requestKey: randomUUID(),
  }),
);
console.log(
  `HTTP smoke passed: ${checks} assertions; upload ${photo.length} bytes converted to WebP. Two isolated demo sessions; no real accounts created.`,
);
