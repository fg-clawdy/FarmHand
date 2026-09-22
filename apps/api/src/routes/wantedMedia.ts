import type { FastifyPluginAsync } from "fastify";
import fs from "node:fs";
import { createReadStream } from "node:fs";
import { wantedFlyerDiskPath } from "../wantedFlyer.js";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export const wantedMediaRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { slug: string } }>("/api/media/wanted/:slug", async (req, reply) => {
    const raw = req.params.slug.replace(/\.png$/i, "");
    if (!SLUG_RE.test(raw)) {
      return reply.code(400).send({ error: "Bad flyer slug." });
    }
    const disk = wantedFlyerDiskPath(raw);
    if (!fs.existsSync(disk)) {
      return reply.code(404).send({ error: "Flyer not ready yet." });
    }
    reply.header("Content-Type", "image/png");
    reply.header("Cache-Control", "public, max-age=60");
    return reply.send(createReadStream(disk));
  });
};
