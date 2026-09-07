import { CROP_KINDS, type CropKind } from "@farmhand/shared";
import { Assets, Rectangle, Texture } from "pixi.js";

export const CROP_STAGE_FRAMES = 4;
/** Plant-only sheets: 1440×720, four equal cells, stem at the bottom of each cell. */
export const CROP_SHEET = { width: 1440, height: 720, frames: 4 } as const;
export const CROP_FRAME_WIDTH = CROP_SHEET.width / CROP_SHEET.frames;
export const CROP_FRAME_HEIGHT = CROP_SHEET.height;
/** Pixi sprite pivot: bottom-center of the stem/seed, seated in the painted mound. */
export const PLANT_STEM_ANCHOR = { x: 0.5, y: 1 } as const;
/** On-texture height of a full crop frame on the farm playfield (mature corn fills most of the cell). */
export const FARM_PLANT_HEIGHT_PX = 50;
/** On-texture height of a full crop frame in the zoomed garden. */
export const ZOOM_PLANT_HEIGHT_PX = 220;

/** Padded 4-frame eat/graze PNG with real alpha (equal cells; Pixi insets so frames never share pixels). */
export const COW_EAT_SHEET = { width: 1704, height: 304, frames: 4 } as const;
/** Each standalone walk PNG is one full cow on this canvas. */
export const COW_WALK_FRAME = { width: 426, height: 304 } as const;

export const PAINTED_ART = {
  playfield: "/art/painted/farmhand_painted_playfield_v3_no_static_cow.jpg",
  gardenZoom: "/art/painted/garden/garden_zoom_3x3.jpg",
  smoke: "/art/painted/tractor_exhaust_smoke_sheet.png",
  /** Two separate PNGs with real alpha — never sliced from a combined walk/eat sheet. */
  cowWalk: ["/art/painted/cow_walk_frame_a.png", "/art/painted/cow_walk_frame_b.png"],
  /** Must stay PNG so eat frames keep a transparent background. */
  cowEat: "/art/painted/cow_eat_sheet.png",
  crops: {
    corn: "/art/painted/plants/plant_corn_stages.png",
    strawberry: "/art/painted/plants/plant_strawberry_stages.png",
    cotton: "/art/painted/plants/plant_cotton_stages.png",
  },
} as const;

export type PaintedArt = {
  playfield: Texture;
  gardenZoom: Texture;
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
  const [playfield, gardenZoom, smoke, walkA, walkB, eat, ...cropSheets] = await Promise.all([
    Assets.load<Texture>(PAINTED_ART.playfield),
    Assets.load<Texture>(PAINTED_ART.gardenZoom),
    Assets.load<Texture>(PAINTED_ART.smoke),
    Assets.load<Texture>(PAINTED_ART.cowWalk[0]),
    Assets.load<Texture>(PAINTED_ART.cowWalk[1]),
    Assets.load<Texture>(PAINTED_ART.cowEat),
    ...CROP_KINDS.map((kind) => Assets.load<Texture>(PAINTED_ART.crops[kind])),
  ]);
  const crops = {} as Record<CropKind, Texture[]>;
  CROP_KINDS.forEach((kind, i) => {
    crops[kind] = sliceSheet(cropSheets[i]!, CROP_STAGE_FRAMES);
  });
  return {
    playfield,
    gardenZoom,
    smokeFrames: sliceSheet(smoke, 6),
    cowWalk: [walkA, walkB],
    cowEat: sliceSheet(eat, COW_EAT_SHEET.frames),
    crops,
  };
}
