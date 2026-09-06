import { Assets, Rectangle, Texture } from "pixi.js";

export const PAINTED_ART = {
  playfield: "/art/painted/farmhand_painted_playfield_v2_blank_signs.jpg",
  smoke: "/art/painted/tractor_exhaust_smoke_sheet.png",
  cow: "/art/painted/cow_walk_eat_sheet.png",
} as const;

export type PaintedArt = {
  playfield: Texture;
  smokeFrames: Texture[];
  cowWalk: Texture[];
  cowEat: Texture[];
};

export function sliceSheet(texture: Texture, frames: number): Texture[] {
  const width = texture.width / frames;
  const height = texture.height;
  return Array.from({ length: frames }, (_, i) => {
    return new Texture({
      source: texture.source,
      frame: new Rectangle(Math.round(i * width), 0, Math.round(width), height),
    });
  });
}

export async function loadPaintedArt(): Promise<PaintedArt> {
  const [playfield, smoke, cow] = await Promise.all([
    Assets.load<Texture>(PAINTED_ART.playfield),
    Assets.load<Texture>(PAINTED_ART.smoke),
    Assets.load<Texture>(PAINTED_ART.cow),
  ]);
  const cowFrames = sliceSheet(cow, 7);
  return {
    playfield,
    smokeFrames: sliceSheet(smoke, 6),
    cowWalk: cowFrames.slice(0, 4),
    cowEat: cowFrames.slice(4, 7),
  };
}
