import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash("sha256")
    .update("coaching-manager:" + (process.env.DATABASE_URL || process.env.POSTGRES_URL || ""))
    .digest("hex");

export function hashPassword(p: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(p, salt, 32).toString("hex");
  return `${salt}:${h}`;
}

export function verifyPassword(p: string, stored: string): boolean {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  const hh = crypto.scryptSync(p, salt, 32);
  const hb = Buffer.from(h, "hex");
  return hb.length === hh.length && crypto.timingSafeEqual(hb, hh);
}

function sign(v: string) {
  return crypto.createHmac("sha256", SECRET).update(v).digest("hex");
}

export async function setSession(id: number) {
  (await cookies()).set("sid", `${id}.${sign(String(id))}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearSession() {
  (await cookies()).delete("sid");
}

export type SessionUser = typeof users.$inferSelect;

export async function getUser(): Promise<SessionUser | null> {
  const raw = (await cookies()).get("sid")?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  if (!id || !sig || sign(id) !== sig) return null;
  const rows = await db.select().from(users).where(eq(users.id, Number(id))).limit(1);
  return rows[0] ?? null;
}

export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  if (!roles.includes(u.role)) redirect("/");
  return u;
}
