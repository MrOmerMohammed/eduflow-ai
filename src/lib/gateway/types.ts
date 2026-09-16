export type GatewayAction =
  | "workspace.context"
  | "workspace.bootstrap"
  | "academic_year.create"
  | "grade.create"
  | "section.create";

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

export function uuidValue(payload: Record<string, unknown>, key: string) {
  const value = stringValue(payload, key);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${key} must be a valid UUID`);
  }
  return value;
}
