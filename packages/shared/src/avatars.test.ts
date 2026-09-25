import assert from "node:assert/strict";
import test from "node:test";
import { AVATAR_PRESETS, AVATAR_PRESET_IDS, avatarPublicUrl, isAvatarPresetId } from "./avatars.js";

test("AVATAR_PRESETS has six unique ids", () => {
  assert.equal(AVATAR_PRESETS.length, 6);
  assert.equal(new Set(AVATAR_PRESET_IDS).size, 6);
  for (const id of ["sun", "seedling", "star", "rainbow", "tractor", "dog"]) {
    assert.equal(isAvatarPresetId(id), true);
  }
});

test("avatarPublicUrl for mascot/preset/selfie", () => {
  assert.equal(avatarPublicUrl({ avatarKind: "mascot" }), null);
  assert.equal(avatarPublicUrl({ avatarKind: "preset", avatarPreset: "sun" }), "/avatars/sun.svg");
  assert.equal(
    avatarPublicUrl({ avatarKind: "selfie", avatarSelfieFile: "kid-pfp-1.jpg" }),
    "/api/profile/avatar-selfie/kid-pfp-1.jpg",
  );
  assert.equal(avatarPublicUrl({ avatarKind: "preset", avatarPreset: "nope" }), null);
});
