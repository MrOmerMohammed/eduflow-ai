export type GatewayAction =
  | "workspace.context"
  | "workspace.bootstrap"
  | "academic_year.create"
  | "grade.create"
  | "section.create"
  | "school.sections"
  | "student.search"
  | "student.get"
  | "student.create"
  | "student.update"
  | "guardian.create"
  | "student.guardian.link"
  | "enrollment.create"
  | "attendance.roster"
  | "attendance.save"
  | "attendance.student.summary";

export type GatewayRequest = {
  action: GatewayAction;
  payload?: Record<string, unknown>;
};

export function stringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export function optionalString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${key} must be text`);
  return value.trim() || null;
}

export function uuidValue(payload: Record<string, unknown>, key: string) {
  const value = stringValue(payload, key);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${key} must be a valid UUID`);
  }
  return value;
}

export function optionalUuid(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${key} must be a valid UUID`);
  }
  return value;
}
