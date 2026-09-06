import { CROP_KINDS, type CropKind } from "@farmhand/shared";
import { Assets, Rectangle, Texture } from "pixi.js";

export const CROP_STAGE_FRAMES = 4;
/** Equal slice width on every crop sheet (1568 / 4). */
export const CROP_FRAME_WIDTH = 392;

export const PAINTED_ART = {
  playfield: "/art/painted/farmhand_painted_playfield_v2_blank_signs.jpg",
  smoke: "/art/painted/tractor_exhaust_smoke_sheet.png",
  cow: "/art/painted/cow_walk_eat_sheet.png",
  crops: {
    corn: "/art/painted/plants/plant_corn_stages.png",
    strawberry: "/art/painted/plants/plant_strawberry_stages.png",
    cotton: "/art/painted/plants/plant_cotton_stages.png",
  },
} as const;

export type PaintedArt = {
  playfield: Texture;
  smokeFrames: Texture[];
  cowWalk: Texture[];
  cowEat: Texture[];
  crops: Record<CropKind, Texture[]>;
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

export function cropStageFrame(crops: Record<CropKind, Texture[]>, kind: CropKind, stage: 1 | 2 | 3 | 4): Texture {
  return crops[kind]?.[stage - 1] ?? Texture.EMPTY;
}

export async function loadPaintedArt(): Promise<PaintedArt> {
  const [playfield, smoke, cow, ...cropSheets] = await Promise.all([
    Assets.load<Texture>(PAINTED_ART.playfield),
    Assets.load<Texture>(PAINTED_ART.smoke),
    Assets.load<Texture>(PAINTED_ART.cow),
    ...CROP_KINDS.map((kind) => Assets.load<Texture>(PAINTED_ART.crops[kind])),
  ]);
  const cowFrames = sliceSheet(cow, 7);
  const crops = {} as Record<CropKind, Texture[]>;
  CROP_KINDS.forEach((kind, i) => {
    crops[kind] = sliceSheet(cropSheets[i]!, CROP_STAGE_FRAMES);
  });
  return {
    playfield,
    smokeFrames: sliceSheet(smoke, 6),
    cowWalk: cowFrames.slice(0, 4),
    cowEat: cowFrames.slice(4, 7),
    crops,
  };
}
