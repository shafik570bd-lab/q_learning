const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function bn(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
}

export function money(v: number): string {
  return "৳" + bn(v.toLocaleString("en-IN"));
}

export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

export function monthStr(): string {
  return todayStr().slice(0, 7);
}

export const bnMonths = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

export function monthLabel(m: string): string {
  const [y, mm] = m.split("-");
  return `${bnMonths[Number(mm) - 1]} ${bn(y)}`;
}

export function daysInMonth(m: string): number {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm, 0).getDate();
}

export function firstWeekday(m: string): number {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).getDay();
}

export const avatarColors = [
  "bg-blue-600", "bg-emerald-500", "bg-amber-500", "bg-violet-600", "bg-rose-600", "bg-cyan-600",
];

export function initial(name: string): string {
  return Array.from(name.trim())[0] ?? "?";
}
