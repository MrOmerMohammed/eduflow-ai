export type SchoolRole = "admin" | "teacher" | "staff";

export const SCHOOL_NAV = [
  { href: "/", label: "Overview", roles: ["admin","teacher","staff"] },
  { href: "/analytics", label: "Analytics", roles: ["admin"] },
  { href: "/students", label: "Students", roles: ["admin","teacher","staff"] },
  { href: "/academic", label: "Academic", roles: ["admin","teacher","staff"] },
  { href: "/attendance", label: "Attendance", roles: ["admin","teacher","staff"] },
  { href: "/exams", label: "Exams", roles: ["admin","teacher"] },
  { href: "/finance", label: "Finance", roles: ["admin","staff"] },
  { href: "/hr", label: "Staff & HR", roles: ["admin","staff"] },
  { href: "/communication", label: "Communication", roles: ["admin","teacher","staff"] },
  { href: "/notifications", label: "Notifications", roles: ["admin","teacher","staff"] },
  { href: "/parent", label: "Parent Portal", roles: ["admin"] },
  { href: "/import", label: "Data Import", roles: ["admin"] },
  { href: "/ai", label: "AI Assistant", roles: ["admin","teacher"] },
  { href: "/school/setup", label: "School setup", roles: ["admin"] },
] as const;

export function normalizeSchoolRole(value: unknown): SchoolRole {
  return value === "teacher" || value === "staff" ? value : "admin";
}

export function allowedRolesForPath(pathname: string): SchoolRole[] {
  const match = SCHOOL_NAV.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return match ? [...match.roles] as SchoolRole[] : ["admin","teacher","staff"];
}
