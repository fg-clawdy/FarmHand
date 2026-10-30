import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import StarBalloonBunch from "./StarBalloonBunch.tsx";

function html(cost: number, shown: number) {
  return renderToString(
    createElement(StarBalloonBunch, {
      cost,
      shown,
      locking: null,
      sparkle: false,
      bounce: true,
      layoutScale: 1,
    }),
  );
}

test("a half-full 200 goal shows a full ghost, a half body, and a half pip", () => {
  const markup = html(200, 100);
  assert.match(markup, /data-qa="balloon-ghost"/);
  assert.match(markup, /data-target-scale="1"/);
  assert.match(markup, /data-body-scale="0\.707/);
  assert.match(markup, /data-fill="0.5"/);
  assert.match(markup, />100</);
  assert.match(markup, /200/);
  assert.doesNotMatch(markup, /Londra|Willow|Finn|Sage|Netflix|donor/i);
});

test("at 400 of 1,100 the next empty balloon is in front of the two full ones", () => {
  const markup = html(1100, 400);
  assert.match(markup, /data-front="2"/);
  assert.match(markup, /data-index="2"[^>]*data-active="1"/);
  assert.doesNotMatch(markup, /data-index="0"[^>]*data-active="1"/);
  assert.equal(markup.match(/data-qa="balloon"[^>]*data-full="1"/g)?.length, 2);
});

test("an empty 1100 goal shows six ghosts, a half-size last ghost, and a nub on every string", () => {
  const markup = html(1100, 0);
  assert.equal(markup.match(/data-qa="balloon-ghost"/g)?.length, 6);
  assert.equal(markup.match(/data-qa="balloon-nub"/g)?.length, 6);
  assert.match(markup, /data-target-scale="0.5"/);
  assert.equal(markup.match(/data-qa="pip"/g)?.length, 6);
  assert.match(markup, /1,100/);
});
