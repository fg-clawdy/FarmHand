import { Container, Sprite } from "pixi.js";
import type { Atlas } from "./atlas";
import { fencePosts, type PlotRect } from "./fenceLayout";
import { isoDepth, isoGround, isoToScreen, TILE_H, TILE_SPRITE_H, TILE_W } from "./iso";

export type { PlotRect } from "./fenceLayout";
export { fencePosts, fenceTouchesInterior } from "./fenceLayout";

export function createFenceRing(atlas: Atlas, rect: PlotRect): Container {
  const root = new Container();
  root.sortableChildren = true;
  const tex = atlas.frame("prop_fence");
  for (const post of fencePosts(rect)) {
    const spr = new Sprite(tex);
    const origin = isoToScreen(post.col, post.row);
    spr.anchor.set(0.5, 0);
    spr.position.set(origin.x + TILE_W / 2, origin.y + TILE_H - TILE_SPRITE_H);
    spr.scale.set(post.flipX ? -1 : 1, 1);
    spr.zIndex = isoDepth(post.col, post.row) + 3;
    root.addChild(spr);
  }
  return root;
}

export function fenceBounds(rect: PlotRect) {
  const posts = fencePosts(rect);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const post of posts) {
    const g = isoGround(post.col, post.row);
    minX = Math.min(minX, g.x - TILE_W / 2);
    maxX = Math.max(maxX, g.x + TILE_W / 2);
    minY = Math.min(minY, g.y - TILE_SPRITE_H * 0.35);
    maxY = Math.max(maxY, g.y + TILE_H / 2);
  }
  return { minX, maxX, minY, maxY };
}
