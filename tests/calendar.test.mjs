import { test } from "node:test";
import assert from "node:assert/strict";
import {
  occursOn,
  monthDays,
  changeMonth,
  shanghaiDate,
} from "../src/lib/calendar.mjs";
test("weekly schedules honor inclusive start/end dates and Sunday", () => {
  const entry = {
    mode: "weekly",
    dayOfWeek: [0],
    startDate: "2026-10-04",
    endDate: "2026-10-11",
  };
  assert.equal(occursOn(entry, "2026-09-27"), false);
  assert.equal(occursOn(entry, "2026-10-04"), true);
  assert.equal(occursOn(entry, "2026-10-05"), false);
  assert.equal(occursOn(entry, "2026-10-11"), true);
  assert.equal(occursOn(entry, "2026-10-18"), false);
});
test("range schedules include both ends", () => {
  const entry = {
    mode: "range",
    startDate: "2026-03-10",
    endDate: "2026-04-06",
  };
  assert.equal(occursOn(entry, "2026-03-09"), false);
  assert.equal(occursOn(entry, "2026-03-10"), true);
  assert.equal(occursOn(entry, "2026-04-06"), true);
  assert.equal(occursOn(entry, "2026-04-07"), false);
});
test("Monday-first calendar handles leap years and year boundaries", () => {
  const days = monthDays("2024-02");
  assert.equal(new Date(`${days[0].date}T12:00:00Z`).getUTCDay(), 1);
  assert.ok(days.some((day) => day.date === "2024-02-29" && !day.outside));
  assert.equal(days.length % 7, 0);
  assert.equal(changeMonth("2026-12", 1), "2027-01");
  assert.equal(changeMonth("2026-01", -1), "2025-12");
});
test("today uses Shanghai time across UTC midnight", () => {
  assert.equal(shanghaiDate(new Date("2026-10-03T18:00:00Z")), "2026-10-04");
});
