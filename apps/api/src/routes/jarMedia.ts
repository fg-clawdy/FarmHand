import type { FastifyPluginAsync } from "fastify";
import fs from "node:fs";
import { createReadStream } from "node:fs";
import { jarArtDiskPath } from "../jarArt.js";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const jarMediaRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>("/api/media/jars/:id", async (req, reply) => {
    const raw = req.params.id.replace(/\.png$/i, "");
    if (!ID_RE.test(raw)) return reply.code(400).send({ error: "Bad jar id." });
    const disk = jarArtDiskPath(raw);
    if (!fs.existsSync(disk)) return reply.code(404).send({ error: "Lid not ready yet." });
    reply.header("Content-Type", "image/png");
    reply.header("Cache-Control", "public, max-age=60");
    return reply.send(createReadStream(disk));
  });
};
