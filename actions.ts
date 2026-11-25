"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, batches, attendance, payments, materials } from "@/db/schema";
import { clearSession, hashPassword, requireRole, setSession, verifyPassword } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => Number(f.get(k) ?? 0) || 0;

function cleanPhone(p: string) {
  return p.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[^0-9+]/g, "");
}

export async function loginAction(f: FormData) {
  await ensureSeed();
  const phone = cleanPhone(s(f, "phone"));
  const pw = s(f, "password");
  const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  const u = rows[0];
  if (!u || !verifyPassword(pw, u.passwordHash)) redirect("/login?e=1");
  await setSession(u.id);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/teacher");
  revalidatePath("/student");
}

async function teacherOwnsBatch(teacherId: number, batchId: number) {
  const b = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  return b[0] && b[0].teacherId === teacherId;
}

// ---------- users ----------
export async function createUserAction(f: FormData) {
  const me = await requireRole("admin", "teacher");
  const role = me.role === "admin" ? s(f, "role") : "student";
  if (!["teacher", "student"].includes(role)) return;
  const name = s(f, "name");
  const phone = cleanPhone(s(f, "phone"));
  const password = s(f, "password") || "123456";
  const batchId = n(f, "batchId") || null;
  if (!name || !phone) return;
  if (me.role === "teacher" && (!batchId || !(await teacherOwnsBatch(me.id, batchId)))) return;
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
  const back = s(f, "back") || (me.role === "admin" ? "/admin" : "/teacher");
  if (exists.length) redirect(back + (back.includes("?") ? "&" : "?") + "err=phone");
  await db.insert(users).values({
    name,
    phone,
    passwordHash: hashPassword(password),
    role,
    batchId: role === "student" ? batchId : null,
    monthlyFee: n(f, "monthlyFee"),
    guardianPhone: s(f, "guardianPhone") || null,
  });
  refresh();
  redirect(back);
}

export async function updateStudentAction(f: FormData) {
  await requireRole("admin");
  const id = n(f, "id");
  await db
    .update(users)
    .set({ batchId: n(f, "batchId") || null, monthlyFee: n(f, "monthlyFee") })
    .where(and(eq(users.id, id), eq(users.role, "student")));
  refresh();
}

export async function resetPasswordAction(f: FormData) {
  await requireRole("admin");
  const pw = s(f, "password");
  if (pw.length < 4) return;
  await db.update(users).set({ passwordHash: hashPassword(pw) }).where(eq(users.id, n(f, "id")));
  refresh();
}

export async function deleteUserAction(f: FormData) {
  const me = await requireRole("admin");
  const id = n(f, "id");
  if (id === me.id) return;
  await db.delete(users).where(eq(users.id, id));
  await db.delete(attendance).where(eq(attendance.studentId, id));
  await db.delete(payments).where(eq(payments.studentId, id));
  refresh();
}

// ---------- batches ----------
export async function createBatchAction(f: FormData) {
  await requireRole("admin");
  const name = s(f, "name");
  if (!name) return;
  await db.insert(batches).values({
    name,
    subject: s(f, "subject"),
    teacherId: n(f, "teacherId") || null,
    schedule: s(f, "schedule"),
    meetLink: s(f, "meetLink"),
  });
  refresh();
}

export async function updateBatchTeacherAction(f: FormData) {
  await requireRole("admin");
  await db.update(batches).set({ teacherId: n(f, "teacherId") || null }).where(eq(batches.id, n(f, "id")));
  refresh();
}

export async function deleteBatchAction(f: FormData) {
  await requireRole("admin");
  const id = n(f, "id");
  await db.delete(batches).where(eq(batches.id, id));
  await db.update(users).set({ batchId: null }).where(eq(users.batchId, id));
  refresh();
}

export async function updateClassInfoAction(f: FormData) {
  const me = await requireRole("admin", "teacher");
  const id = n(f, "batchId");
  if (me.role === "teacher" && !(await teacherOwnsBatch(me.id, id))) return;
  let link = s(f, "meetLink");
  if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
  await db.update(batches).set({ meetLink: link, schedule: s(f, "schedule") }).where(eq(batches.id, id));
  refresh();
}

// ---------- attendance ----------
export async function saveAttendanceAction(f: FormData) {
  const me = await requireRole("admin", "teacher");
  const batchId = n(f, "batchId");
  const date = s(f, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (me.role === "teacher" && !(await teacherOwnsBatch(me.id, batchId))) return;
  const studs = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.batchId, batchId), eq(users.role, "student")));
  const present = new Set(f.getAll("present").map((v) => Number(v)));
  for (const st of studs) {
    await db.delete(attendance).where(and(eq(attendance.studentId, st.id), eq(attendance.date, date)));
  }
  if (studs.length) {
    await db.insert(attendance).values(studs.map((st) => ({ studentId: st.id, batchId, date, present: present.has(st.id) })));
  }
  refresh();
  redirect(`/teacher?batch=${batchId}&date=${date}&saved=1`);
}

// ---------- payments ----------
export async function addPaymentAction(f: FormData) {
  await requireRole("admin");
  const amount = n(f, "amount");
  const month = s(f, "month");
  if (amount <= 0 || !/^\d{4}-\d{2}$/.test(month)) return;
  await db.insert(payments).values({ studentId: n(f, "studentId"), month, amount });
  refresh();
}

// ---------- materials ----------
export async function addMaterialAction(f: FormData) {
  const me = await requireRole("admin", "teacher");
  const batchId = n(f, "batchId");
  if (me.role === "teacher" && !(await teacherOwnsBatch(me.id, batchId))) return;
  const title = s(f, "title");
  if (!title) return;
  let link = s(f, "link");
  if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
  await db.insert(materials).values({ batchId, teacherId: me.id, title, body: s(f, "body"), link });
  refresh();
}

export async function deleteMaterialAction(f: FormData) {
  const me = await requireRole("admin", "teacher");
  const id = n(f, "id");
  const m = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  if (!m[0]) return;
  if (me.role === "teacher" && m[0].teacherId !== me.id) return;
  await db.delete(materials).where(eq(materials.id, id));
  refresh();
}
