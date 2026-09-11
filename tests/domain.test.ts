import test from "node:test";
import assert from "node:assert/strict";
import {
  latin,
  normalizeDate,
  rentalDays,
  quote,
  canTransition,
  defaultRequirements,
  matches,
  suitability,
  addDays,
  todayTehran,
  type Listing,
} from "../lib/domain";
import { fallbackSearch, fallbackDraft } from "../lib/ai-parser";
import { demoInventory } from "../lib/seed";
test("Persian and Arabic numerals, Jalali leap days and invalid dates", () => {
  assert.equal(latin("۱۲۳٤٥٦"), "123456");
  assert.equal(normalizeDate("۱۴۰۵/۰۶/۲۱"), "2026-09-12");
  assert.equal(normalizeDate("۱۴۰۳/۱۲/۳۰"), "2025-03-20");
  assert.equal(normalizeDate("۱۴۰۴/۱۲/۳۰"), "");
  assert.equal(normalizeDate("2026-02-30"), "");
});
test("half-open noon-to-noon days and integer toman quote separate deposits", () => {
  assert.equal(rentalDays("2026-09-12", "2026-09-15"), 3);
  assert.throws(() => rentalDays("2026-09-15", "2026-09-15"));
  assert.throws(() => rentalDays("2026-09-15", "2026-10-16"));
  const q = quote(850000, 35000000, "2026-09-12", "2026-09-15");
  assert.equal(q.rental, 2550000);
  assert.equal(q.deposit, 35000000);
  assert.equal(q.estimatedCommission, 127500);
  assert.equal(q.currency, "IRT");
});
test("state machine rejects privilege changes and terminal transitions", () => {
  assert.equal(canTransition("requested", "accepted", "owner"), true);
  assert.equal(canTransition("requested", "accepted", "renter"), false);
  assert.equal(canTransition("requested", "completed", "owner"), false);
  assert.equal(canTransition("completed", "accepted", "owner"), false);
  assert.equal(canTransition("handed_over", "cancelled", "owner"), false);
  assert.equal(canTransition("requested", "expired", "system"), true);
});
test("search fallback extracts Persian budget, deposit, software, days without silently relaxing", () => {
  const r = fallbackSearch(
    "سه روز تدوین 4K با پریمیر، بودجه ۳ میلیون، ودیعه تا ۳۵ میلیون",
    defaultRequirements(),
  ).requirements;
  assert.equal(r.budget, 3000000);
  assert.equal(r.maxDeposit, 35000000);
  assert.equal(r.workload, "4k");
  assert.equal(r.software, "Premiere");
  assert.equal(rentalDays(r.startDate, r.endDate), 3);
  const cheap = fallbackSearch("بودجه ۱۰۰ تومان، ودیعه ۰ تومان", defaultRequirements()).requirements;
  assert.equal(cheap.maxDeposit, 0);
  assert.equal(cheap.budget, 100);
  const rial = fallbackSearch("بودجه ۳۰۰۰۰۰۰۰ ریال", defaultRequirements()).requirements;
  assert.equal(rial.budget, 3000000);
});
test("draft extracts stated values only, ignores photo assumptions", () => {
  const d = fallbackDraft("مک‌بوک پرو M2 Pro، رم ۱۶ گیگ، حافظه ۵۱۲ گیگ، همراه شارژر و کیف");
  assert.equal(d.ram, 16);
  assert.equal(d.storage, 512);
  assert.equal(d.chip, "M2 Pro");
  const unknown = fallbackDraft("عکس یک مک‌بوک ایر M3 بسیار تمیز");
  assert.equal(unknown.ram, null);
  assert.equal(unknown.storage, null);
});
test("strict filters exclude blocked dates, missing RAM and impossible budgets", () => {
  const inventory = demoInventory().map((l, i) => ({
    ...l,
    id: String(i),
    workspaceId: "x",
    ownerId: "y",
    ownerName: "sample",
    synthetic: true,
    createdAt: "",
  })) as Listing[];
  const r = { ...defaultRequirements(), workload: "4k" as const, budget: 3000000, maxDeposit: 35000000 };
  const found = inventory.filter((l) => matches(l, r));
  assert.ok(found.length > 0);
  assert.ok(found.every((l) => l.ram !== null && l.ram >= 16));
  assert.ok(!found.some((l) => l.blocked.length));
  assert.equal(inventory.filter((l) => matches(l, { ...r, budget: 10 })).length, 0);
  assert.equal(suitability(inventory[8], r).eligible, false);
  assert.equal(addDays(todayTehran(), 1), defaultRequirements().startDate);
});
