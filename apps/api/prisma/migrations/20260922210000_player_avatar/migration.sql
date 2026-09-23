-- Player profile picture (mascot | preset | selfie). Does not affect watering selfie.
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "avatarKind" TEXT NOT NULL DEFAULT 'mascot';
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "avatarPreset" TEXT;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "avatarSelfieFile" TEXT;
