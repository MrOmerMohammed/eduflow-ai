import { readFileSync } from "node:fs";

const typesSource = readFileSync("src/lib/gateway/types.ts", "utf8");
const routeSource = readFileSync("src/app/api/gateway/route.ts", "utf8");

const declared = [...typesSource.matchAll(/\|\s*"([a-z0-9_.]+)"/g)].map((m) => m[1]);
const implemented = [...routeSource.matchAll(/body\.action\s*===\s*(["'])([^"']+)\1/g)].map((m) => m[2]);

const rpcMapStart = routeSource.indexOf("const rpcMap");
const rpcMapEnd = routeSource.indexOf("if(rpcMap[body.action])", rpcMapStart);
const rpcSource = rpcMapStart >= 0 && rpcMapEnd > rpcMapStart
  ? routeSource.slice(rpcMapStart, rpcMapEnd)
  : "";
const rpcKeys = [...rpcSource.matchAll(/"([a-z0-9_.]+)"\s*:\s*\[/g)].map((m) => m[1]);

const implementedSet = new Set([...implemented, ...rpcKeys]);
const declaredSet = new Set(declared);

const missing = declared.filter((action) => !implementedSet.has(action));
const undeclared = [...implementedSet].filter((action) => !declaredSet.has(action));
const duplicateDeclared = declared.filter((action, index) => declared.indexOf(action) !== index);

console.log(`Declared gateway actions: ${declared.length}`);
console.log(`Implemented gateway actions: ${implementedSet.size}`);

if (missing.length || undeclared.length || duplicateDeclared.length) {
  if (missing.length) console.error(`Missing implementations: ${missing.join(", ")}`);
  if (undeclared.length) console.error(`Undeclared implementations: ${undeclared.join(", ")}`);
  if (duplicateDeclared.length) console.error(`Duplicate declarations: ${[...new Set(duplicateDeclared)].join(", ")}`);
  process.exit(1);
}

console.log("API contract gate: PASS");
