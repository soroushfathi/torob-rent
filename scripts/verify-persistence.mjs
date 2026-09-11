import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const saved = JSON.parse(
  await readFile(".local/http-persistence.json", "utf8"),
);
const headers = {
  Cookie: saved.cookie,
  Origin: saved.origin,
  "Content-Type": "application/json",
};
let r = await fetch(saved.base + "/api/session", {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "switch", role: "owner" }),
});
assert.equal(r.status, 200);
r = await fetch(saved.base + "/api/listings/" + saved.listingId, { headers });
assert.equal(r.status, 200);
const { listing } = await r.json();
assert.equal(listing.title, "HTTP upload persistence demo");
assert.equal(listing.status, "paused");
assert.equal(listing.photos[0], saved.url);
r = await fetch(saved.base + saved.url, { headers });
assert.equal(r.status, 200);
const bytes = Buffer.from(await r.arrayBuffer());
assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
assert.equal(bytes.length, 49328);
console.log(
  "Persistence verified after application restart: same authenticated session, paused listing, media URL and 49,328-byte WebP.",
);
