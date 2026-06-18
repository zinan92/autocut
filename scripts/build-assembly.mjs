#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assemblyToMarkdown,
  buildAssembly,
  resolveManifestSources,
} from "../packages/assembly/index.mjs";
import { readJson, requireFile, writeJson } from "../packages/shared/json.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(args.manifest ?? args._[0] ?? "workflow/manifest.json");
const outDir = resolve(args["out-dir"] ?? "remotion-host-overlay-work/assembly");

const manifest = readJson(requireFile(manifestPath, "manifest"));
const sources = resolveManifestSources(manifest, manifestPath);
const probes = {};
let orientation = null;

for (const source of sources) {
  const probe = probeMedia(source.path);
  probes[source.id] = probe;
  if (!orientation) orientation = probe.orientation;
  if (probe.orientation !== orientation) {
    throw new Error(
      `Source orientation mismatch: ${source.id} is ${probe.orientation}, expected ${orientation}`,
    );
  }
}

const assembly = buildAssembly({
  manifest,
  manifestPath,
  sourceProbes: probes,
  options: {
    splitRatio: Number(manifest.assembly?.splitRatio ?? args["split-ratio"] ?? 0.8),
    insertThirdIntoSecond:
      manifest.assembly?.insertThirdIntoSecond ?? args["insert-third-into-second"] ?? undefined,
    maxBlockSeconds: Number(manifest.assembly?.maxBlockSeconds ?? 18),
    silenceBreakSeconds: Number(manifest.assembly?.silenceBreakSeconds ?? 0.7),
  },
});

mkdirSync(outDir, { recursive: true });
const jsonPath = resolve(outDir, "assembly.json");
const mdPath = resolve(outDir, "assembly.md");

writeJson(jsonPath, assembly);
writeFileSync(mdPath, assemblyToMarkdown(assembly), "utf8");

console.log(`Assembly JSON: ${jsonPath}`);
console.log(`Assembly Markdown: ${mdPath}`);
console.log(`Sources: ${sources.length}`);
console.log(`Blocks: ${assembly.blocks.length}`);
