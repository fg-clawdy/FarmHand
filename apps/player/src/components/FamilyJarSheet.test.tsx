import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { SHARED_GOAL_COPY, type FarmPlayerCard, type PublicPlot, type PublicSharedGoal } from "@farmhand/shared";
import FamilyJarSheet, { jarDonorFromCard, jarSpendGate } from "./FamilyJarSheet";

function plot(): PublicPlot {
  return {
    slot: 0,
    state: "empty",
    tier: null,
    plantedAt: null,
    maturesAt: null,
    remainingMs: 0,
    growthStage: null,
    emoji: null,
    face: null,
    ready: false,
  };
}

function card(id: string, name: string, hasPin = false): FarmPlayerCard {
  return {
    id,
    name,
    mascot: "cow",
    avatarKind: "mascot",
    avatarPreset: null,
    avatarUrl: null,
    seeds: 4,
    provisionalSeeds: 0,
    points: 570,
    fertilizer: 0,
    seedShards: 0,
    canWater: true,
    plots: [plot()],
    hasPin,
    unlocked: true,
    isActive: true,
  };
}

const jar: PublicSharedGoal = {
  id: "netflix",
  title: "Netflix - 1 Month",
  emoji: "📺",
  targetPoints: 1000,
  filledPoints: 5,
  status: "OPEN",
  tintIndex: 0,
  artUrl: null,
  artStatus: "DEFAULT",
};

const players = [card("willow", "Willow", true), card("finn", "Finn", false)];

function html(node: ReturnType<typeof createElement>) {
  return renderToString(node)
    .replace(/<!-- -->/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}

test("farm-page jar tap shows the kid picker before amount chips", () => {
  const markup = html(
    createElement(FamilyJarSheet, {
      jar,
      players,
      preview: { availablePoints: 570 },
      onClose: () => undefined,
      onUpdated: () => undefined,
    }),
  );
  assert.match(markup, new RegExp(SHARED_GOAL_COPY.whoAdding.replace("?", "\\?")));
  assert.match(markup, /data-qa="jar-who"/);
  assert.match(markup, /Willow/);
  assert.match(markup, /Finn/);
  assert.doesNotMatch(markup, /data-qa="jar-amounts"/);
  assert.doesNotMatch(markup, /data-qa="jar-wallet"/);
  assert.doesNotMatch(markup, /tube-chip/);
  assert.doesNotMatch(markup, /Kid Wallet/);
  assert.doesNotMatch(markup, /Enter your 4-digit PIN/);
});

test("a PIN kid must see the pad before amount chips", () => {
  const markup = html(
    createElement(FamilyJarSheet, {
      jar,
      players,
      sessionPlayer: jarDonorFromCard(players[0]!),
      preview: { availablePoints: 570 },
      onClose: () => undefined,
      onUpdated: () => undefined,
    }),
  );
  assert.match(markup, /Enter your 4-digit PIN/);
  assert.match(markup, /aria-label="WILLOW"/);
  assert.doesNotMatch(markup, /data-qa="jar-amounts"/);
  assert.doesNotMatch(markup, /data-qa="jar-wallet"/);
  assert.doesNotMatch(markup, /Finn/);
});

test("a kid with no PIN can reach the wallet without the pad", () => {
  const markup = html(
    createElement(FamilyJarSheet, {
      jar,
      players,
      sessionPlayer: jarDonorFromCard(players[1]!),
      preview: { availablePoints: 570 },
      onClose: () => undefined,
      onUpdated: () => undefined,
    }),
  );
  assert.match(markup, /data-qa="jar-wallet"/);
  assert.match(markup, /data-donor="Finn"/);
  assert.match(markup, /Finn's wallet/);
  assert.match(markup, /570★/);
  assert.match(markup, /data-qa="jar-amounts"/);
  assert.match(markup, />Switch</);
  assert.doesNotMatch(markup, /data-qa="jar-who"/);
  assert.doesNotMatch(markup, /Enter your 4-digit PIN/);
  assert.doesNotMatch(markup, /Willow/);
  assert.doesNotMatch(markup, /Kid Wallet/);
});

test("switching a PIN kid clears verification and a no-PIN kid does not need it", () => {
  assert.equal(jarSpendGate({ picked: false, hasPin: true, pinVerified: false }), "pick");
  assert.equal(jarSpendGate({ picked: true, hasPin: true, pinVerified: false }), "pin");
  assert.equal(jarSpendGate({ picked: true, hasPin: true, pinVerified: true }), "spend");
  assert.equal(jarSpendGate({ picked: true, hasPin: true, pinVerified: false }), "pin");
  assert.equal(jarSpendGate({ picked: true, hasPin: false, pinVerified: false }), "spend");
});
