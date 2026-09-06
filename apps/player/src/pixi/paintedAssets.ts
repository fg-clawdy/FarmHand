import { CROP_KINDS, type CropKind } from "@farmhand/shared";
import { Assets, Rectangle, Texture } from "pixi.js";

export const CROP_STAGE_FRAMES = 4;
/** Equal slice width on every crop sheet (1568 / 4). */
export const CROP_FRAME_WIDTH = 392;

export const PAINTED_ART = {
  playfield: "/art/painted/farmhand_painted_playfield_v2_blank_signs.jpg",
  smoke: "/art/painted/tractor_exhaust_smoke_sheet.png",
  /** Prefer v2 when present; both are 7 equal cells (walk 0–3, eat 4–6). */
  cow: "/art/painted/cow_walk_eat_sheet_v2.png",
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

/** 2px inset so adjacent frames never share an edge pixel (stops filter bleed). */
export const SHEET_INSET = 2;

export function sheetFrameRects(
  sheetW: number,
  sheetH: number,
  frames: number,
  inset: number = SHEET_INSET,
): Array<{ x: number; y: number; w: number; h: number }> {
  const cell = Math.floor(sheetW / frames);
  return Array.from({ length: frames }, (_, i) => ({
    x: i * cell + inset,
    y: inset,
    w: cell - inset * 2,
    h: sheetH - inset * 2,
  }));
}

export function sliceSheet(texture: Texture, frames: number, inset: number = SHEET_INSET): Texture[] {
  return sheetFrameRects(texture.width, texture.height, frames, inset).map(
    (rect) =>
      new Texture({
        source: texture.source,
        frame: new Rectangle(rect.x, rect.y, rect.w, rect.h),
      }),
  );
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
