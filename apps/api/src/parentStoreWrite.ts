import { slugifyTitle } from "./parentChoreWrite.js";

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

export type ParentSkuBody = {
  title?: unknown;
  emoji?: unknown;
  description?: unknown;
  starCost?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
  slug?: unknown;
};

function readString(value: unknown, label: string, opts?: { allowEmpty?: boolean }): string {
  if (typeof value !== "string") fail(`Please enter a ${label}.`);
  const trimmed = value.trim();
  if (!trimmed && !opts?.allowEmpty) fail(`Please enter a ${label}.`);
  return trimmed;
}

function readBool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(`${label} should be yes or no.`);
  return value;
}

function readStarCost(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
    fail("Star cost should be a whole number of at least 1.");
  }
  return n;
}

export function parseSkuCreate(body: ParentSkuBody) {
  const title = readString(body.title, "title");
  const emoji = readString(body.emoji ?? "⭐", "emoji") || "⭐";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const starCost = readStarCost(body.starCost);
  const isActive = body.isActive === undefined ? true : readBool(body.isActive, "On the shelf");
  const sortOrder =
    body.sortOrder === undefined || body.sortOrder === null || body.sortOrder === ""
      ? 100
      : Number(body.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) fail("Sort order should be a whole number.");
  const slug = body.slug ? slugifyTitle(String(body.slug)) : slugifyTitle(title);
  return { title, emoji, description, starCost, isActive, sortOrder, slug };
}

export function parseSkuPatch(body: ParentSkuBody) {
  const patch: {
    title?: string;
    emoji?: string;
    description?: string;
    starCost?: number;
    isActive?: boolean;
    sortOrder?: number;
  } = {};
  if (body.title !== undefined) patch.title = readString(body.title, "title");
  if (body.emoji !== undefined) patch.emoji = readString(body.emoji, "emoji") || "⭐";
  if (body.description !== undefined) {
    patch.description = typeof body.description === "string" ? body.description.trim() : "";
  }
  if (body.starCost !== undefined) patch.starCost = readStarCost(body.starCost);
  if (body.isActive !== undefined) patch.isActive = readBool(body.isActive, "On the shelf");
  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== "") {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) fail("Sort order should be a whole number.");
    patch.sortOrder = sortOrder;
  }
  return patch;
}
