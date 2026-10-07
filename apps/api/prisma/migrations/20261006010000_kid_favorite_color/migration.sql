-- Kid-picked favorite/accent color id (see KID_COLORS). Null until the kid picks one.
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "color" TEXT;