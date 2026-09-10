import { CROP_KINDS, type CropKind } from "@farmhand/shared";
import { Assets, Rectangle, Texture } from "pixi.js";

export const CROP_STAGE_FRAMES = 4;
/**
 * Approved crop sheets: plant + clumpy soil disc as one unit.
 * Four equal padded cells (480). Heights differ. Packed 392-wide sheets
 * stored left foliage in the previous cell; scraps are restored. Strawberry
 * frames: seed, sprout, 3-flower/green-berry, ripe. Do not mirror-replace
 * the flowering cell — that deletes the third blossom.
 */
export const CROP_SHEET = { width: 1920, frames: 4 } as const;
export const CROP_FRAME_WIDTH = CROP_SHEET.width / CROP_SHEET.frames;
export const CROP_SHEET_HEIGHT: Record<CropKind, number> = {
  corn: 854,
  strawberry: 464,
  cotton: 623,
};

type Disc = { x: number; y: number; d: number };

/**
 * Soil-disc center and diameter in each 480-wide unpacked cell.
 * Pivot the sprite here so the disc — not the cell midpoint — sits on the mound UV.
 */
export const CROP_DISC_IN_CELL: Record<CropKind, readonly Disc[]> = {
  corn: [
    { x: 240, y: 763, d: 316 },
    { x: 236, y: 768, d: 312 },
    { x: 239, y: 766, d: 300 },
    { x: 223, y: 766, d: 311 },
  ],
  strawberry: [
    { x: 233, y: 353, d: 290 },
    { x: 247, y: 364, d: 284 },
    { x: 233, y: 380, d: 283 },
    { x: 234, y: 350, d: 310 },
  ],
  cotton: [
    { x: 238, y: 498, d: 325 },
    { x: 210, y: 504, d: 320 },
    { x: 208, y: 511, d: 307 },
    { x: 228, y: 501, d: 322 },
  ],
};

/** Fallback when a frame has no measured disc. */
export const PLANT_DISC_ANCHOR = { x: 0.5, y: 0.88 } as const;

/** On-texture disc cover. 80% of the first soil-disc pass so plants stay inside neighbors. */
export const PLANT_COVER_FACTOR = 0.8;
export const ZOOM_MOUND_COVER_PX = Math.round(220 * PLANT_COVER_FACTOR);
export const FARM_MOUND_COVER_PX = Math.round(80 * PLANT_COVER_FACTOR);

/** @deprecated plant-only leftover; disc cover is the live scale. */
export const FARM_PLANT_HEIGHT_PX = FARM_MOUND_COVER_PX;
export const FARM_PLANT_BURY_PX = 0;
export const ZOOM_PLANT_HEIGHT_PX = ZOOM_MOUND_COVER_PX;
export const ZOOM_PLANT_BURY_PX = 0;
/** @deprecated use CROP_SHEET_HEIGHT[kind] */
export const CROP_FRAME_HEIGHT = CROP_SHEET_HEIGHT.corn;

/** Padded 4-frame eat/graze PNG with real alpha (equal cells; Pixi insets so frames never share pixels). */
export const COW_EAT_SHEET = { width: 1704, height: 304, frames: 4 } as const;
/** 4-frame Wanted poster sheet: pinned, tearing, torn-off, pinning up. Equal 315×470 cells. */
export const WANTED_POSTER_SHEET = { width: 1260, height: 470, frames: 4 } as const;
/**
 * Cream paper + WANTED header inside each cell. The sheet paints a cork plate
 * around the poster; crop it off so only paper layers on the standing stake.
 */
export const WANTED_POSTER_PAPER_INSET = { x: 28, y: 20, w: 258, h: 386 } as const;
/**
 * Standing corkboard PNG includes posts + grass. Loaded full as a ground stake.
 * Hang rect is the cork face (no posts) used to nest the paper poster.
 */
export const CORKBOARD_HANG = { x: 6, y: 4, w: 708, h: 556 } as const;

export const PAINTED_ART = {
  playfield: "/art/painted/farmhand_painted_playfield_v3_no_static_cow.jpg",
  gardenZoom: "/art/painted/garden/garden_zoom_3x3.jpg",
  smoke: "/art/painted/tractor_exhaust_smoke_sheet.png",
  /** Two separate PNGs with real alpha — never sliced from a combined walk/eat sheet. */
  cowWalk: ["/art/painted/cow_walk_frame_a.png", "/art/painted/cow_walk_frame_b.png"],
  /** Must stay PNG so eat frames keep a transparent background. */
  cowEat: "/art/painted/cow_eat_sheet.png",
  corkboard: "/art/painted/farm/corkboard.png",
  wantedPoster: "/art/painted/farm/wanted_poster_sheet.png",
  crops: {
    corn: "/art/painted/plants/plant_corn_stages.png?v=3blossom",
    strawberry: "/art/painted/plants/plant_strawberry_stages.png?v=3blossom",
    cotton: "/art/painted/plants/plant_cotton_stages.png?v=3blossom",
  },
} as const;

export type PaintedArt = {
  playfield: Texture;
  gardenZoom: Texture;
  smokeFrames: Texture[];
  cowWalk: Texture[];
  cowEat: Texture[];
  corkboard: Texture;
  wantedPosterFrames: Texture[];
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
        // Frame is atlas pixels; orig is local sprite size from (0,0) so trim/UV
        // math never treats frame.x as a sprite offset (would slide discs off mounds).
        frame: new Rectangle(rect.x, rect.y, rect.w, rect.h),
        orig: new Rectangle(0, 0, rect.w, rect.h),
      }),
  );
}

/** Paper-only Wanted frames — same size for pinned / tearing / torn / pinning. */
export function wantedPosterFrameRects(): Array<{ x: number; y: number; w: number; h: number }> {
  const cell = Math.floor(WANTED_POSTER_SHEET.width / WANTED_POSTER_SHEET.frames);
  const { x, y, w, h } = WANTED_POSTER_PAPER_INSET;
  return Array.from({ length: WANTED_POSTER_SHEET.frames }, (_, i) => ({
    x: i * cell + x,
    y,
    w,
    h,
  }));
}

export function sliceWantedPoster(texture: Texture): Texture[] {
  return wantedPosterFrameRects().map(
    (rect) =>
      new Texture({
        source: texture.source,
        frame: new Rectangle(rect.x, rect.y, rect.w, rect.h),
        orig: new Rectangle(0, 0, rect.w, rect.h),
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
  const [playfield, gardenZoom, smoke, walkA, walkB, eat, corkboard, wantedPoster, ...cropSheets] = await Promise.all([
    Assets.load<Texture>(PAINTED_ART.playfield),
    Assets.load<Texture>(PAINTED_ART.gardenZoom),
    Assets.load<Texture>(PAINTED_ART.smoke),
    Assets.load<Texture>(PAINTED_ART.cowWalk[0]),
    Assets.load<Texture>(PAINTED_ART.cowWalk[1]),
    Assets.load<Texture>(PAINTED_ART.cowEat),
    Assets.load<Texture>(PAINTED_ART.corkboard),
    Assets.load<Texture>(PAINTED_ART.wantedPoster),
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
    corkboard,
    wantedPosterFrames: sliceWantedPoster(wantedPoster),
    crops,
  };
}
