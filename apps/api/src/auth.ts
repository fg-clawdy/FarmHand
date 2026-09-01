import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db.js";

export const PLAYER_COOKIE = "fh_player";
export const ADMIN_COOKIE = "fh_admin";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export async function hashSecret(value: string): Promise<string> {
  return bcrypt.hash(value, 10);
}

export async function verifySecret(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

export function cookieOpts(maxAgeSeconds: number) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: maxAgeSeconds,
  };
}

export function readBearerOrCookie(request: FastifyRequest, cookieName: string): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return request.cookies[cookieName];
}

export async function getPlayerSession(request: FastifyRequest) {
  const token = readBearerOrCookie(request, PLAYER_COOKIE);
  if (!token) return null;
  const session = await prisma.playerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { player: { include: { plots: { orderBy: { slot: "asc" } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.player.isActive) return null;
  return session;
}

export async function requirePlayer(request: FastifyRequest, reply: FastifyReply) {
  const session = await getPlayerSession(request);
  if (!session) {
    reply.code(401).send({ error: "Sign in with your garden PIN first." });
    return null;
  }
  return session;
}

export async function getAdminSession(request: FastifyRequest) {
  const token = readBearerOrCookie(request, ADMIN_COOKIE);
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const session = await getAdminSession(request);
  if (!session) {
    reply.code(401).send({ error: "Admin login required." });
    return null;
  }
  return session;
}
