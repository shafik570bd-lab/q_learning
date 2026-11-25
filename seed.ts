import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users, batches, attendance, payments, materials } from "@/db/schema";
import { hashPassword } from "./auth";
import { todayStr, monthStr } from "./utils";

let seeded = false;

async function ensureTables() {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY, name text NOT NULL, phone text NOT NULL UNIQUE,
      password_hash text NOT NULL, role text NOT NULL, batch_id integer,
      monthly_fee integer NOT NULL DEFAULT 0, guardian_phone text,
      created_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS batches (
      id serial PRIMARY KEY, name text NOT NULL, subject text NOT NULL DEFAULT '',
      teacher_id integer, schedule text NOT NULL DEFAULT '', meet_link text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS attendance (
      id serial PRIMARY KEY, student_id integer NOT NULL, batch_id integer NOT NULL,
      date text NOT NULL, present boolean NOT NULL DEFAULT false);
    CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_date ON attendance (student_id, date);
    CREATE TABLE IF NOT EXISTS payments (
      id serial PRIMARY KEY, student_id integer NOT NULL, month text NOT NULL,
      amount integer NOT NULL, created_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS materials (
      id serial PRIMARY KEY, batch_id integer NOT NULL, teacher_id integer NOT NULL,
      title text NOT NULL, body text NOT NULL DEFAULT '', link text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now());
  `));
}

export async function ensureSeed() {
  if (seeded) return;
  await ensureTables();
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  if (c > 0) {
    seeded = true;
    return;
  }
  const [admin] = await db
    .insert(users)
    .values({ name: "অ্যাডমিন", phone: "01700000000", passwordHash: hashPassword("admin123"), role: "admin" })
    .returning();
  void admin;
  const [teacher] = await db
    .insert(users)
    .values({ name: "করিম স্যার", phone: "01800000000", passwordHash: hashPassword("teacher123"), role: "teacher" })
    .returning();
  const [b1] = await db
    .insert(batches)
    .values({ name: "এসএসসি গণিত - ক", subject: "গণিত", teacherId: teacher.id, schedule: "শনি, সোম, বুধ - সন্ধ্যা ৭টা", meetLink: "https://meet.google.com/abc-defg-hij" })
    .returning();
  await db.insert(batches).values({ name: "এইচএসসি পদার্থ", subject: "পদার্থবিজ্ঞান", teacherId: teacher.id, schedule: "রবি, মঙ্গল - বিকাল ৪টা", meetLink: "" });

  const names = ["রাফি আহমেদ", "নুসরাত জাহান", "তানভীর হাসান", "সুমাইয়া মিম", "আরিফুল ইসলাম"];
  const pw = hashPassword("student123");
  const studs = await db
    .insert(users)
    .values(names.map((n, i) => ({ name: n, phone: `0190000000${i + 1}`, passwordHash: pw, role: "student", batchId: b1.id, monthlyFee: 1500 })))
    .returning();

  const today = todayStr();
  const m = monthStr();
  const day = Number(today.slice(8, 10));
  const rows: (typeof attendance.$inferInsert)[] = [];
  for (let d = 1; d < day; d++) {
    if (d % 2 === 0) continue;
    const date = `${m}-${String(d).padStart(2, "0")}`;
    studs.forEach((s, i) => rows.push({ studentId: s.id, batchId: b1.id, date, present: (d + i) % 5 !== 0 }));
  }
  if (rows.length) await db.insert(attendance).values(rows);
  await db.insert(payments).values([
    { studentId: studs[0].id, month: m, amount: 1500 },
    { studentId: studs[1].id, month: m, amount: 1500 },
  ]);
  await db.insert(materials).values({
    batchId: b1.id,
    teacherId: teacher.id,
    title: "অধ্যায় ১: বাস্তব সংখ্যা - বাড়ির কাজ",
    body: "অনুশীলনী ১.১ এর ১ থেকে ১০ নম্বর প্রশ্ন সমাধান করে আনবে।",
    link: "",
  });
  seeded = true;
}
