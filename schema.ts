import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // admin | teacher | student
  batchId: integer("batch_id"),
  monthlyFee: integer("monthly_fee").notNull().default(0),
  guardianPhone: text("guardian_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull().default(""),
  teacherId: integer("teacher_id"),
  schedule: text("schedule").notNull().default(""),
  meetLink: text("meet_link").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull(),
    batchId: integer("batch_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    present: boolean("present").notNull().default(false),
  },
  (t) => [uniqueIndex("attendance_student_date").on(t.studentId, t.date)],
);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  month: text("month").notNull(), // YYYY-MM
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull(),
  teacherId: integer("teacher_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  link: text("link").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
