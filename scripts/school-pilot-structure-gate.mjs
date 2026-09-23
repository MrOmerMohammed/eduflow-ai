#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";

const requiredPaths = [
  "src/app/api/health/route.ts",
  "src/app/api/import/route.ts",
  "src/app/api/import/school/route.ts",
  "src/app/api/school/onboarding/route.ts",
  "src/app/api/workspace/bootstrap/route.ts",
  "src/app/academic/page.tsx",
  "src/app/attendance/page.tsx",
  "src/app/ai/page.tsx",
  "src/app/analytics/page.tsx",
];

const missing = requiredPaths.filter((path) => !existsSync(join(process.cwd(), path)));

if (missing.length > 0) {
  console.error("School-pilot structure gate failed. Missing required routes:");
  for (const path of missing) console.error(`- ${path}`);
  process.exit(1);
}

console.log(`School-pilot structure gate passed: ${requiredPaths.length} critical routes verified.`);
