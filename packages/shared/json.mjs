import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const requireFile = (path, label = "file") => {
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(`${label} not found: ${resolved}`);
  }
  return resolved;
};
