import { CROP_KINDS, type CropKind } from "@farmhand/shared";
import { Assets, Rectangle, Texture } from "pixi.js";

export const CROP_STAGE_FRAMES = 4;
/**
 * Approved crop sheets: plant + clumpy soil disc as one unit.
 * All three are 1568 wide / 4 equal cells (392). Heights differ.
 */
export const CROP_SHEET = { width: 1568, frames: 4 } as const;
export const CROP_FRAME_WIDTH = CROP_SHEET.width / CROP_SHEET.frames;
export const CROP_SHEET_HEIGHT: Record<CropKind, number> = {
  corn: 854,
  strawberry: 464,
  cotton: 623,
};

type Disc = { x: number; y: number; d: number };

/**
 * Soil-disc center and diameter in each 392-wide cell (brown pixels, no re-pack).
 * Pivot the sprite here so the disc — not the cell midpoint — sits on the mound UV.
 */
export const CROP_DISC_IN_CELL: Record<CropKind, readonly Disc[]> = {
  corn: [
    { x: 196, y: 762, d: 316 },
    { x: 161, y: 763, d: 312 },
    { x: 154, y: 760, d: 300 },
    { x: 188, y: 763, d: 311 },
  ],
  strawberry: [
    { x: 160, y: 363, d: 290 },
    { x: 146, y: 357, d: 284 },
    { x: 146, y: 357, d: 283 },
    { x: 177, y: 371, d: 290 },
  ],
  cotton: [
    { x: 195, y: 520, d: 325 },
    { x: 167, y: 513, d: 320 },
    { x: 158, y: 501, d: 307 },
    { x: 185, y: 512, d: 322 },
  ],
};

/** Fallback when a frame has no measured disc. */
export const PLANT_DISC_ANCHOR = { x: 0.5, y: 0.88 } as const;

/** On-texture diameter of the painted zoom pebble-ring to cover. */
export const ZOOM_MOUND_COVER_PX = 220;
/** On-texture diameter of a farm mini-mound to cover. */
export const FARM_MOUND_COVER_PX = 80;

/** @deprecated plant-only leftover; disc cover is the live scale. */
export const FARM_PLANT_HEIGHT_PX = FARM_MOUND_COVER_PX;
export const FARM_PLANT_BURY_PX = 0;
export const ZOOM_PLANT_HEIGHT_PX = ZOOM_MOUND_COVER_PX;
export const ZOOM_PLANT_BURY_PX = 0;
/** @deprecated use CROP_SHEET_HEIGHT[kind] */
export const CROP_FRAME_HEIGHT = CROP_SHEET_HEIGHT.corn;

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

export function cropDisc(kind: CropKind, stage: 1 | 2 | 3 | 4): Disc | undefined {
  return CROP_DISC_IN_CELL[kind]?.[stage - 1];
}

/** Pixi pivot so the soil-disc center sits on the mound UV. */
export function cropDiscAnchor(kind: CropKind, stage: 1 | 2 | 3 | 4) {
  const disc = cropDisc(kind, stage);
  if (!disc) return { x: PLANT_DISC_ANCHOR.x, y: PLANT_DISC_ANCHOR.y };
  const fw = CROP_FRAME_WIDTH - SHEET_INSET * 2;
  const fh = CROP_SHEET_HEIGHT[kind] - SHEET_INSET * 2;
  return {
    x: (disc.x - SHEET_INSET) / fw,
    y: (disc.y - SHEET_INSET) / fh,
  };
}

/** @deprecated name from the plant-only pass; same as cropDiscAnchor. */
export const cropStemAnchor = cropDiscAnchor;

/** Uniform scale so this frame's soil disc matches `coverPx` on the playfield. */
export function cropCoverScale(kind: CropKind, stage: 1 | 2 | 3 | 4, coverPx: number) {
  const disc = cropDisc(kind, stage);
  const d = disc?.d || CROP_FRAME_WIDTH;
  return coverPx / d;
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
