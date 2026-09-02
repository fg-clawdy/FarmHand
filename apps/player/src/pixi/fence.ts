import { Container, Sprite } from "pixi.js";
import type { Atlas } from "./atlas";
import { fencePosts, type PlotRect } from "./fenceLayout";
import { isoDepth, isoToScreen, TILE_H, TILE_SPRITE_H } from "./iso";

export type { PlotRect } from "./fenceLayout";
export { fencePosts, fenceTouchesInterior } from "./fenceLayout";

export function createFenceRing(atlas: Atlas, rect: PlotRect): Container {
  const root = new Container();
  root.sortableChildren = true;
  const sw = atlas.frame("prop_fence_sw");
  const se = atlas.frame("prop_fence_se");
  for (const post of fencePosts(rect)) {
    const spr = new Sprite(post.flipX ? se : sw);
    const origin = isoToScreen(post.col, post.row);
    spr.anchor.set(0, 0);
    spr.position.set(origin.x, origin.y + TILE_H - TILE_SPRITE_H);
    spr.zIndex = isoDepth(post.col, post.row) + 3;
    root.addChild(spr);
  }
  return root;
}
