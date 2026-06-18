#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assemblyToEdl,
  mergeAssemblyWithMarkdownOrder,
} from "../packages/assembly/index.mjs";
import { readJson, requireFile, writeJson } from "../packages/shared/json.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const assemblyPath = resolve(args.assembly ?? args._[0] ?? "remotion-host-overlay-work/assembly/assembly.json");
const outPath = resolve(args.out ?? "remotion-host-overlay-work/assembly/edl.json");
const markdownPath = args.markdown ? resolve(args.markdown) : null;

let assembly = readJson(requireFile(assemblyPath, "assembly"));

if (markdownPath) {
  if (!existsSync(markdownPath)) {
    throw new Error(`Markdown assembly not found: ${markdownPath}`);
  }
  assembly = mergeAssemblyWithMarkdownOrder(
    assembly,
    readFileSync(markdownPath, "utf8"),
  );
}

const edl = assemblyToEdl(assembly);
writeJson(outPath, edl);

console.log(`EDL written: ${outPath}`);
console.log(`Ranges: ${edl.ranges.length}`);
console.log(`Expected duration: ${edl.metrics.outputDuration.toFixed(3)}s`);
