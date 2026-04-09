/**
 * Pure-function unit tests for the new gamification helpers and quest config.
 * No DB, no HTTP — these can run in any node process via:
 *   npx tsx --test backend/__tests__/gamification.test.ts
 *
 * The full integration tests for POST /quests (transaction, idempotency,
 * sequence validation) require a test Neon branch and are out of scope.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStreak } from "../src/lib/gamification/streak";
import {
  QUEST_CONFIG,
  UNLOCK_ORDER,
  isSequenceSatisfied,
  recomputePass,
} from "../src/lib/quests/quest-config";

test("nextStreak: same day is no-op", () => {
  const now = new Date();
  assert.equal(nextStreak(now, 5), 5);
});

test("nextStreak: yesterday increments", () => {
  const yesterday = new Date(Date.now() - 86_400_000);
  // Force yesterday to be a different UTC day
  yesterday.setUTCHours(0, 0, 0, 0);
  assert.equal(nextStreak(yesterday, 5), 6);
});

test("nextStreak: gap resets", () => {
  const longAgo = new Date(Date.now() - 5 * 86_400_000);
  assert.equal(nextStreak(longAgo, 99), 1);
});

test("nextStreak: null lastActive starts at 1", () => {
  assert.equal(nextStreak(null, 0), 1);
});

test("isSequenceSatisfied: first building is always allowed", () => {
  assert.equal(isSequenceSatisfied("town_hall", new Set()), true);
});

test("isSequenceSatisfied: skipping ahead is rejected", () => {
  assert.equal(isSequenceSatisfied("library", new Set(["town_hall"])), false);
});

test("isSequenceSatisfied: in-order unlock allowed", () => {
  assert.equal(
    isSequenceSatisfied("library", new Set(["town_hall", "school"])),
    true
  );
});

test("UNLOCK_ORDER matches QUEST_CONFIG keys", () => {
  for (const id of UNLOCK_ORDER) {
    assert.ok(QUEST_CONFIG[id], `missing config for ${id}`);
  }
});

test("recomputePass: standard quest passes at threshold", () => {
  // town_hall threshold is 7
  assert.equal(recomputePass("town_hall", 7, 10), true);
  assert.equal(recomputePass("town_hall", 6, 10), false);
});

test("recomputePass: bakery uses passScore (75)", () => {
  assert.equal(recomputePass("bakery", 75, 100), true);
  assert.equal(recomputePass("bakery", 74, 100), false);
});

test("recomputePass: unknown building fails closed", () => {
  assert.equal(recomputePass("nonsense", 100, 100), false);
});
